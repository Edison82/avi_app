import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getGranjaId } from '@/lib/getGranjaId';

// Detalle de cuántos huevos de cada categoría se entrega
const detalleCategoriaSchema = z.object({
  categoria: z.enum(['JUMBO', 'AAA', 'AA', 'A', 'B', 'C'] as const),
  cantidad:  z.coerce.number().int().min(1),
});

const entregaSchema = z.object({
  fecha:               z.string(),
  precioVentaUnitario: z.coerce.number().min(0),
  clienteNombre:       z.string().optional(),
  observaciones:       z.string().optional(),
  // Array de categorías con sus cantidades
  detalles:            z.array(detalleCategoriaSchema).min(1, 'Debes entregar al menos una categoría'),
});

// ── GET — Obtener entregas con paginación ─────────────────────
export async function GET(request: Request) {
  try {
    const { granjaId, usuarioId, rol } = await getGranjaId();

    const { searchParams } = new URL(request.url);
    const limite = Math.max(1, parseInt(searchParams.get('limite') || '4'));
    const pagina = Math.max(1, parseInt(searchParams.get('pagina') || '1'));

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
        skip:    (pagina - 1) * limite,
        take:    limite,
      }),
      prisma.entregaConductor.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data:    entregas,
      pagination: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite) || 1,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

// ── POST — Registrar entrega con detalle por categoría ────────
export async function POST(request: Request) {
  try {
    const { granjaId, usuarioId, rol } = await getGranjaId();

    if (rol !== 'CONDUCTOR' && rol !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para registrar entregas' },
        { status: 403 }
      );
    }

    const body      = await request.json();
    const validacion = entregaSchema.safeParse(body);

    if (!validacion.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: validacion.error.issues },
        { status: 400 }
      );
    }

    const { fecha, precioVentaUnitario, clienteNombre, observaciones, detalles } = validacion.data;

    // Calcular total de huevos sumando todas las categorías
    const huevosEntregados = detalles.reduce((s, d) => s + d.cantidad, 0);
    const ingresoTotal     = huevosEntregados * precioVentaUnitario;
    const fechaObj         = new Date(fecha);

    const inicioDia = new Date(fechaObj);
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(fechaObj);
    finDia.setHours(23, 59, 59, 999);

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Crear la entrega con el JSON de detalles por categoría
      const entrega = await tx.entregaConductor.create({
        data: {
          fecha:                fechaObj,
          huevosEntregados,
          precioVentaUnitario,
          ingresoTotal,
          clienteNombre,
          observaciones,
          // Guardamos el detalle completo en JSON
          detalleCategoriasJson: detalles,
          granjaId,
          conductorId: usuarioId,
        },
      });

      // 2. Actualizar el registro diario de ese día (suma a huevosVendidos e ingresos)
      const registroDia = await tx.registroDiario.findFirst({
        where: { granjaId, fecha: { gte: inicioDia, lte: finDia } },
        orderBy: { createdAt: 'desc' },
      });

      if (registroDia) {
        await tx.registroDiario.update({
          where: { id: registroDia.id },
          data: {
            huevosVendidos: { increment: huevosEntregados },
            ingresoTotal:   { increment: ingresoTotal },
          },
        });
      }

      return entrega;
    });

    return NextResponse.json({ success: true, data: resultado }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}