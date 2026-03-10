import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { registroDiarioSchema, GastoInput } from '@/lib/validations/schemas';

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

    const granjaId = session.user.granjaId;
    if (!granjaId) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { total: 0, pagina: 1, limite: 10, totalPaginas: 1 },
      });
    }

    const { searchParams } = new URL(request.url);
    const limite = Math.max(1, parseInt(searchParams.get('limite') || '10'));
    const pagina = Math.max(1, parseInt(searchParams.get('pagina') || '1'));
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    // Construir filtros
    const where: Prisma.RegistroDiarioWhereInput = {
      granjaId,
      usuarioId: session.user.id,
    };

    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) {
        where.fecha.gte = new Date(`${fechaDesde}T00:00:00`);
      }
      if (fechaHasta) {
        where.fecha.lte = new Date(`${fechaHasta}T23:59:59.999`);
      }
    }

    // Obtener registros con paginación
    const [registros, total] = await Promise.all([
      prisma.registroDiario.findMany({
        where,
        include: {
          gastos: {
            include: {
              categoria: true,
            },
          },
        },
        orderBy: {
          fecha: 'desc',
        },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      prisma.registroDiario.count({ where }),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: registros,
        pagination: {
          total,
          pagina,
          limite,
          totalPaginas: Math.ceil(total / limite) || 1,
        },
      },
      { status: 200 }
    );
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
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const granjaId = session.user.granjaId;
    if (!granjaId) {
      return NextResponse.json(
        { success: false, error: 'No tienes una granja configurada' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validar datos
    const validacion = registroDiarioSchema.safeParse(body);

    if (!validacion.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: validacion.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      fecha,
      huevosProducidos,
      huevosVendidos,
      precioVentaUnitario,
      observaciones,
      gastos,
    } = validacion.data;

    // Normalizar fecha
    const fechaObj = new Date(`${fecha}T00:00:00`);

    // Verificar si ya existe un registro para esta fecha EN ESTA GRANJA
    const registroExistente = await prisma.registroDiario.findUnique({
      where: {
        granjaId_fecha: {
          granjaId,
          fecha: fechaObj,
        },
      },
    });

    if (registroExistente) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un registro para esta fecha' },
        { status: 409 }
      );
    }

    // Calcular ingreso total
    const ingresoTotal = huevosVendidos * precioVentaUnitario;

    // Crear registro con gastos
    const nuevoRegistro = await prisma.registroDiario.create({
      data: {
        fecha: fechaObj,
        huevosProducidos,
        huevosVendidos,
        precioVentaUnitario,
        ingresoTotal,
        observaciones,
        granjaId,
        usuarioId: session.user.id,
        gastos: {
          create: (gastos ?? []).map((g: GastoInput) => ({
            descripcion: g.descripcion,
            monto: g.monto,
            categoriaId: g.categoriaId,
          })),
        },
      },
      include: {
        gastos: {
          include: {
            categoria: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Registro creado exitosamente',
        data: nuevoRegistro,
      },
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