import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getGranjaId } from '@/lib/getGranjaId';
 
const HUEVOS_POR_CUBETA = 30;
 
const editarCargaSchema = z.object({
  categoriaHuevo: z.enum(['JUMBO', 'AAA', 'AA', 'A', 'B', 'C'] as const),
  cubetas:        z.coerce.number().int().min(1),
  observaciones:  z.string().optional(),
});
 
// ── PUT ───────────────────────────────────────────────────────
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }   // ✅ Next.js 16
) {
  try {
    const { id } = await params;
    const { granjaId } = await getGranjaId();
 
    const cargaExistente = await prisma.cargaConductor.findFirst({
      where: { id, granjaId },
    });
 
    if (!cargaExistente) {
      return NextResponse.json({ success: false, error: 'Carga no encontrada' }, { status: 404 });
    }
 
    const body = await request.json();
    const val  = editarCargaSchema.safeParse(body);
 
    if (!val.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: val.error.issues },
        { status: 400 }
      );
    }
 
    const { categoriaHuevo, cubetas, observaciones } = val.data;
    const nuevosHuevos   = cubetas * HUEVOS_POR_CUBETA;
    const anteriorHuevos = cargaExistente.huevosEquivalentes;
 
    const cargaActualizada = await prisma.$transaction(async (tx) => {
      if (categoriaHuevo !== cargaExistente.categoriaHuevo) {
        await tx.inventarioHuevos.upsert({
          where:  { granjaId_categoriaHuevo: { granjaId, categoriaHuevo: cargaExistente.categoriaHuevo } },
          update: { cantidadHuevos: { increment: anteriorHuevos } },
          create: { granjaId, categoriaHuevo: cargaExistente.categoriaHuevo, cantidadHuevos: anteriorHuevos },
        });
 
        const stockNuevo = await tx.inventarioHuevos.findUnique({
          where: { granjaId_categoriaHuevo: { granjaId, categoriaHuevo } },
        });
        if ((stockNuevo?.cantidadHuevos ?? 0) < nuevosHuevos) {
          throw new Error(`Stock insuficiente en ${categoriaHuevo}`);
        }
 
        await tx.inventarioHuevos.upsert({
          where:  { granjaId_categoriaHuevo: { granjaId, categoriaHuevo } },
          update: { cantidadHuevos: { decrement: nuevosHuevos } },
          create: { granjaId, categoriaHuevo, cantidadHuevos: 0 },
        });
      } else {
        const diferencia = nuevosHuevos - anteriorHuevos;
        if (diferencia > 0) {
          const stock = await tx.inventarioHuevos.findUnique({
            where: { granjaId_categoriaHuevo: { granjaId, categoriaHuevo } },
          });
          if ((stock?.cantidadHuevos ?? 0) < diferencia) {
            throw new Error(`Stock insuficiente para aumentar la carga`);
          }
          await tx.inventarioHuevos.upsert({
            where:  { granjaId_categoriaHuevo: { granjaId, categoriaHuevo } },
            update: { cantidadHuevos: { decrement: diferencia } },
            create: { granjaId, categoriaHuevo, cantidadHuevos: 0 },
          });
        } else if (diferencia < 0) {
          await tx.inventarioHuevos.upsert({
            where:  { granjaId_categoriaHuevo: { granjaId, categoriaHuevo } },
            update: { cantidadHuevos: { increment: -diferencia } },
            create: { granjaId, categoriaHuevo, cantidadHuevos: -diferencia },
          });
        }
      }
 
      return tx.cargaConductor.update({
        where: { id },
        data:  { categoriaHuevo, cubetas, huevosEquivalentes: nuevosHuevos, observaciones },
        include: { conductor: { select: { id: true, nombre: true, email: true } } },
      });
    });
 
    return NextResponse.json({ success: true, data: cargaActualizada });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    const status  = message.startsWith('Stock insuficiente') ? 422 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
 
// ── DELETE ────────────────────────────────────────────────────
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }   // ✅ Next.js 16
) {
  try {
    const { id } = await params;
    const { granjaId } = await getGranjaId();
 
    const carga = await prisma.cargaConductor.findFirst({
      where:  { id, granjaId },
      select: { id: true, categoriaHuevo: true, huevosEquivalentes: true },
    });
 
    if (!carga) {
      return NextResponse.json({ success: false, error: 'Carga no encontrada' }, { status: 404 });
    }
 
    await prisma.$transaction([
      prisma.inventarioHuevos.upsert({
        where:  { granjaId_categoriaHuevo: { granjaId, categoriaHuevo: carga.categoriaHuevo } },
        update: { cantidadHuevos: { increment: carga.huevosEquivalentes } },
        create: { granjaId, categoriaHuevo: carga.categoriaHuevo, cantidadHuevos: carga.huevosEquivalentes },
      }),
      prisma.cargaConductor.delete({ where: { id: carga.id } }),
    ]);
 
    return NextResponse.json({
      success: true,
      message: `Carga eliminada y huevos devueltos al inventario`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
 