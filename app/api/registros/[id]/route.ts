import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registroDiarioSchema } from '@/lib/validations/schemas';
import { getGranjaId } from '@/lib/getGranjaId';
 
// ── GET ───────────────────────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { granjaId } = await getGranjaId();
    if (!granjaId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
 
    const registro = await prisma.registroDiario.findFirst({
      where: { id: params.id, granjaId },
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
// Al editar un registro, hay que ajustar el inventario por la diferencia
// entre los valores anteriores y los nuevos (categoría y/o cantidad).
//
// Casos posibles:
//   A) Misma categoría, misma cantidad   → sin cambio en inventario
//   B) Misma categoría, distinta cantidad → increment/decrement la diferencia
//   C) Distinta categoría                → revertir los huevos a la categoría
//                                          anterior y acumularlos en la nueva
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { granjaId } = await getGranjaId();
    if (!granjaId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
 
    const registroExistente = await prisma.registroDiario.findFirst({
      where: { id: params.id, granjaId },
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
 
    const ingresoTotal        = huevosVendidos * precioVentaUnitario;
    const categoriaAnterior   = registroExistente.categoriaHuevo;
    const cantidadAnterior    = registroExistente.huevosProducidos;
    const diferenciaMortalidad = (mortalidad ?? 0) - registroExistente.mortalidad;
 
    const registroActualizado = await prisma.$transaction(async (tx) => {
      // ── 1. Actualizar gastos ──
      await tx.gastoDiario.deleteMany({ where: { registroId: params.id } });
 
      const registro = await tx.registroDiario.update({
        where: { id: params.id },
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
 
      // ── 2. Ajustar inventario por categoría/cantidad ──
      if (categoriaHuevo !== categoriaAnterior) {
        // Caso C: categoría cambió → revertir anterior, acumular en nueva
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
        // Caso A/B: misma categoría, ajustar solo la diferencia
        const diferencia = huevosProducidos - cantidadAnterior;
        if (diferencia !== 0) {
          await tx.inventarioHuevos.upsert({
            where:  { granjaId_categoriaHuevo: { granjaId, categoriaHuevo } },
            update: { cantidadHuevos: { increment: diferencia } },
            create: { granjaId, categoriaHuevo, cantidadHuevos: Math.max(0, diferencia) },
          });
        }
      }
 
      // ── 3. Ajustar aves activas si cambió la mortalidad ──
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
// Al eliminar un registro, revertimos los huevosProducidos del inventario
// para que el stock no quede inflado con huevos ya no registrados.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { granjaId } = await getGranjaId();
    if (!granjaId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
 
    const registro = await prisma.registroDiario.findFirst({
      where:  { id: params.id, granjaId },
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
      // Restaurar aves si había mortalidad registrada
      ...(registro.mortalidad > 0
        ? [prisma.granja.update({
            where: { id: granjaId },
            data:  { numeroAves: { increment: registro.mortalidad } },
          })]
        : []
      ),
      // Eliminar el registro (gastos se borran en cascada)
      prisma.registroDiario.delete({ where: { id: registro.id } }),
    ]);
 
    return NextResponse.json({ success: true, message: 'Registro eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar registro:', error);
    return NextResponse.json({ success: false, error: 'Error al eliminar' }, { status: 500 });
  }
}