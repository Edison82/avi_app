import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registroDiarioSchema } from '@/lib/validations/schemas';
import { getGranjaId } from '@/lib/getGranjaId';

// ── GET ───────────────────────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { granjaId } = await getGranjaId();

    if (!granjaId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const registro = await prisma.registroDiario.findFirst({
      where: { id, granjaId },
      include: {
        gastos:  { include: { categoria: true } },
        usuario: { select: { id: true, nombre: true, email: true, rol: true } },
      },
    });

    if (!registro) {
      return NextResponse.json({ success: false, error: 'Registro no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: registro });
  } catch (error) {
    console.error('Error al obtener registro:', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}

// ── PUT ───────────────────────────────────────────────────────
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { granjaId } = await getGranjaId();

    if (!granjaId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const registroExistente = await prisma.registroDiario.findFirst({
      where: { id, granjaId },
    });

    if (!registroExistente) {
      return NextResponse.json({ success: false, error: 'Registro no encontrado' }, { status: 404 });
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
      fecha, huevosProducidos, huevosVendidos, precioVentaUnitario,
      observaciones, mortalidad, categoriaHuevo, gastos,
    } = validacion.data;

    const ingresoTotal         = huevosVendidos * precioVentaUnitario;
    const categoriaAnterior    = registroExistente.categoriaHuevo;
    const cantidadAnterior     = registroExistente.huevosProducidos;
    const diferenciaMortalidad = (mortalidad ?? 0) - registroExistente.mortalidad;

    const registroActualizado = await prisma.$transaction(async (tx) => {
      // 1. Borrar gastos anteriores y actualizar registro
      await tx.gastoDiario.deleteMany({ where: { registroId: id } });

      const registro = await tx.registroDiario.update({
        where: { id },
        data: {
          fecha:               new Date(`${fecha}T00:00:00`),
          huevosProducidos,
          huevosVendidos,
          precioVentaUnitario,
          ingresoTotal,
          observaciones,
          mortalidad:          mortalidad ?? 0,
          categoriaHuevo,
          gastos: {
            create: (gastos ?? []).map((g) => ({
              descripcion: g.descripcion,
              monto:       g.monto,
              categoriaId: g.categoriaId,
            })),
          },
        },
        include: {
          gastos:  { include: { categoria: true } },
          usuario: { select: { id: true, nombre: true, email: true, rol: true } },
        },
      });

      // 2. Ajustar inventario
      if (categoriaHuevo !== categoriaAnterior) {
        // Categoría cambió → revertir anterior, acumular en nueva
        await tx.inventarioHuevos.upsert({
          where:  { granjaId_categoriaHuevo: { granjaId, categoriaHuevo: categoriaAnterior } },
          update: { cantidadHuevos: { decrement: cantidadAnterior } },
          create: { granjaId, categoriaHuevo: categoriaAnterior, cantidadHuevos: 0 },
        });
        await tx.inventarioHuevos.upsert({
          where:  { granjaId_categoriaHuevo: { granjaId, categoriaHuevo } },
          update: { cantidadHuevos: { increment: huevosProducidos } },
          create: { granjaId, categoriaHuevo, cantidadHuevos: huevosProducidos },
        });
      } else {
        // Misma categoría → ajustar diferencia
        const diferencia = huevosProducidos - cantidadAnterior;
        if (diferencia !== 0) {
          await tx.inventarioHuevos.upsert({
            where:  { granjaId_categoriaHuevo: { granjaId, categoriaHuevo } },
            update: { cantidadHuevos: { increment: diferencia } },
            create: { granjaId, categoriaHuevo, cantidadHuevos: Math.max(0, diferencia) },
          });
        }
      }

      // 3. Ajustar aves si cambió la mortalidad
      if (diferenciaMortalidad !== 0) {
        await tx.granja.update({
          where: { id: granjaId },
          data:  { numeroAves: { decrement: diferenciaMortalidad } },
        });
      }

      return registro;
    });

    return NextResponse.json({ success: true, data: registroActualizado });
  } catch (error) {
    console.error('Error al actualizar registro:', error);
    return NextResponse.json({ success: false, error: 'Error al actualizar' }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { granjaId } = await getGranjaId();

    if (!granjaId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const registro = await prisma.registroDiario.findFirst({
      where:  { id, granjaId },
      select: { id: true, huevosProducidos: true, categoriaHuevo: true, mortalidad: true },
    });

    if (!registro) {
      return NextResponse.json(
        { success: false, error: 'No se encontró el registro o no tienes permiso' },
        { status: 404 }
      );
    }

    await prisma.$transaction([
      // Revertir huevos del inventario
      prisma.inventarioHuevos.upsert({
        where:  { granjaId_categoriaHuevo: { granjaId, categoriaHuevo: registro.categoriaHuevo } },
        update: { cantidadHuevos: { decrement: registro.huevosProducidos } },
        create: { granjaId, categoriaHuevo: registro.categoriaHuevo, cantidadHuevos: 0 },
      }),
      // Restaurar aves si había mortalidad
      ...(registro.mortalidad > 0
        ? [prisma.granja.update({
            where: { id: granjaId },
            data:  { numeroAves: { increment: registro.mortalidad } },
          })]
        : []
      ),
      // Eliminar registro (gastos se borran en cascada)
      prisma.registroDiario.delete({ where: { id: registro.id } }),
    ]);

    return NextResponse.json({ success: true, message: 'Registro eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar registro:', error);
    return NextResponse.json({ success: false, error: 'Error al eliminar' }, { status: 500 });
  }
}