import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { registroDiarioSchema, GastoInput } from '@/lib/validations/schemas';
import { getGranjaId } from '@/lib/getGranjaId';
 
// GET - Obtener registros del usuario autenticado
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }
 
    const { granjaId, usuarioId, rol } = await getGranjaId();
    if (!granjaId) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { total: 0, pagina: 1, limite: 10, totalPaginas: 1 },
      });
    }
 
    const { searchParams } = new URL(request.url);
    const limite     = Math.max(1, parseInt(searchParams.get('limite')   || '10'));
    const pagina     = Math.max(1, parseInt(searchParams.get('pagina')   || '1'));
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
 
    const where: Prisma.RegistroDiarioWhereInput = { granjaId };
    if (rol !== 'ADMIN') where.usuarioId = usuarioId;
 
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha.gte = new Date(`${fechaDesde}T00:00:00`);
      if (fechaHasta) where.fecha.lte = new Date(`${fechaHasta}T23:59:59.999`);
    }
 
    const [registros, total] = await Promise.all([
      prisma.registroDiario.findMany({
        where,
        include: {
          gastos: { include: { categoria: true } },
          usuario: {
            select: { id: true, nombre: true, email: true, rol: true },
          },
        },
        orderBy: { fecha: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      prisma.registroDiario.count({ where }),
    ]);
 
    return NextResponse.json({
      success: true,
      data: registros,
      pagination: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite) || 1,
      },
    });
  } catch (error) {
    console.error('Error al obtener registros:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener registros' },
      { status: 500 }
    );
  }
}
 
// POST - Crear nuevo registro diario
export async function POST(request: Request) {
  try {
    const { granjaId, usuarioId } = await getGranjaId();
    if (!granjaId) {
      return NextResponse.json(
        { success: false, error: 'No tienes una granja configurada' },
        { status: 400 }
      );
    }
 
    const body       = await request.json();
    const validacion = registroDiarioSchema.safeParse(body);
 
    if (!validacion.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: validacion.error.issues },
        { status: 400 }
      );
    }
 
    const {
      fecha,
      huevosProducidos,
      huevosVendidos,
      precioVentaUnitario,
      observaciones,
      mortalidad,
      gastos,
    } = validacion.data;
 
    const fechaObj = new Date(`${fecha}T00:00:00`);
 
    const registroExistente = await prisma.registroDiario.findUnique({
      where: { granjaId_fecha: { granjaId, fecha: fechaObj } },
    });
 
    if (registroExistente) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un registro para esta fecha' },
        { status: 409 }
      );
    }
 
    const ingresoTotal = huevosVendidos * precioVentaUnitario;
 
    // Transacción: crea el registro y descuenta mortalidad de Granja.numeroAves
    const nuevoRegistro = await prisma.$transaction(async (tx) => {
      const registro = await tx.registroDiario.create({
        data: {
          fecha: fechaObj,
          huevosProducidos,
          huevosVendidos,
          precioVentaUnitario,
          ingresoTotal,
          observaciones,
          mortalidad: mortalidad ?? 0,
          granjaId,
          usuarioId,
          gastos: {
            create: (gastos ?? []).map((g: GastoInput) => ({
              descripcion: g.descripcion,
              monto:       g.monto,
              categoriaId: g.categoriaId,
            })),
          },
        },
        include: {
          gastos: { include: { categoria: true } },
          usuario: {
            select: { id: true, nombre: true, email: true, rol: true },
          },
        },
      });
 
      // Descontar aves muertas del total activo de la granja
      if (mortalidad && mortalidad > 0) {
        await tx.granja.update({
          where: { id: granjaId },
          data: { numeroAves: { decrement: mortalidad } },
        });
      }
 
      return registro;
    });
 
    return NextResponse.json(
      { success: true, message: 'Registro creado exitosamente', data: nuevoRegistro },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error al crear registro:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear registro' },
      { status: 500 }
    );
  }
}