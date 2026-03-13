import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getGranjaId } from '@/lib/getGranjaId';

const entregaSchema = z.object({
  fecha: z.string(),
  huevosEntregados:    z.coerce.number().int().min(1),
  precioVentaUnitario: z.coerce.number().min(0),
  clienteNombre:  z.string().optional(),
  observaciones:  z.string().optional(),
});

// ── GET — Obtener entregas con paginación ──────────────────────
export async function GET(request: Request) {
  try {
    const { granjaId, usuarioId, rol } = await getGranjaId();

    const { searchParams } = new URL(request.url);
    const limite = Math.max(1, parseInt(searchParams.get('limite') || '10'));
    const pagina = Math.max(1, parseInt(searchParams.get('pagina') || '1'));

    // El conductor solo ve sus propias entregas; admin ve todas
    const where =
      rol === 'ADMIN'
        ? { granjaId }
        : { granjaId, conductorId: usuarioId };

    const [entregas, total] = await Promise.all([
      prisma.entregaConductor.findMany({
        where,
        include: {
          conductor: { select: { id: true, nombre: true, email: true } },
        },
        orderBy: { fecha: 'desc' },
        skip:  (pagina - 1) * limite,
        take:  limite,
      }),
      prisma.entregaConductor.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: entregas,
      pagination: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite) || 1,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error al obtener entregas:', error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

// ── POST — Registrar entrega y descontar huevos del registro diario ──
export async function POST(request: Request) {
  try {
    const { granjaId, usuarioId, rol } = await getGranjaId();

    if (rol !== 'CONDUCTOR' && rol !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para registrar entregas' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validacion = entregaSchema.safeParse(body);

    if (!validacion.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: validacion.error.issues },
        { status: 400 }
      );
    }

    const {
      fecha,
      huevosEntregados,
      precioVentaUnitario,
      clienteNombre,
      observaciones,
    } = validacion.data;

    const ingresoTotal = huevosEntregados * precioVentaUnitario;
    const fechaObj     = new Date(fecha);

    // Inicio y fin del día para buscar el registro diario
    const inicioDia = new Date(fechaObj);
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(fechaObj);
    finDia.setHours(23, 59, 59, 999);

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Crear la entrega del conductor
      const entrega = await tx.entregaConductor.create({
        data: {
          fecha:               fechaObj,
          huevosEntregados,
          precioVentaUnitario,
          ingresoTotal,
          clienteNombre,
          observaciones,
          granjaId,
          conductorId: usuarioId,
        },
      });

      // 2. Buscar el registro diario más reciente de esa fecha en la granja
      //    para descontar los huevos entregados de huevosVendidos
      const registroDia = await tx.registroDiario.findFirst({
        where: {
          granjaId,
          fecha: { gte: inicioDia, lte: finDia },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (registroDia) {
        // Recalcular huevosVendidos e ingresoTotal sumando esta entrega
        const nuevosHuevosVendidos = registroDia.huevosVendidos + huevosEntregados;
        // Ingreso adicional usando el precio de la entrega del conductor
        const ingresoAdicional     = huevosEntregados * precioVentaUnitario;
        const nuevoIngreso         = Number(registroDia.ingresoTotal) + ingresoAdicional;

        await tx.registroDiario.update({
          where: { id: registroDia.id },
          data: {
            huevosVendidos: nuevosHuevosVendidos,
            ingresoTotal:   nuevoIngreso,
          },
        });
      }

      return entrega;
    });

    return NextResponse.json({ success: true, data: resultado }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error al registrar entrega:', error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
} 