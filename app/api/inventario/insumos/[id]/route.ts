import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getGranjaId } from '@/lib/getGranjaId';

const editarInsumoSchema = z.object({
  nombre:      z.string().min(1),
  descripcion: z.string().optional(),
  unidad:      z.string().min(1),
  stockMinimo: z.coerce.number().min(0),
  activo:      z.boolean().optional(),
});

const movimientoSchema = z.object({
  tipo:           z.enum(['ENTRADA', 'SALIDA']),
  cantidad:       z.coerce.number().min(0.01, 'Cantidad mínima 0.01'),
  precioUnitario: z.coerce.number().min(0).optional(),
  observaciones:  z.string().optional(),
});

// ── PUT — Editar insumo ───────────────────────────────────────
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Next.js 15: params es una Promise, hay que awaitearlo
    const { id } = await params;
    const { granjaId, rol } = await getGranjaId();

    if (rol !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 });
    }

    const insumo = await prisma.insumoInventario.findFirst({
      where: { id, granjaId },
    });

    if (!insumo) {
      return NextResponse.json({ success: false, error: 'Insumo no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const val  = editarInsumoSchema.safeParse(body);

    if (!val.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: val.error.issues },
        { status: 400 }
      );
    }

    const actualizado = await prisma.insumoInventario.update({
      where: { id },
      data:  val.data,
    });

    return NextResponse.json({ success: true, data: actualizado });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── DELETE — Desactivar insumo ────────────────────────────────
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { granjaId, rol } = await getGranjaId();

    if (rol !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 });
    }

    const insumo = await prisma.insumoInventario.findFirst({
      where: { id, granjaId },
    });

    if (!insumo) {
      return NextResponse.json({ success: false, error: 'Insumo no encontrado' }, { status: 404 });
    }

    // Desactivar en lugar de borrar para preservar historial de movimientos
    await prisma.insumoInventario.update({
      where: { id },
      data:  { activo: false },
    });

    return NextResponse.json({ success: true, message: `Insumo "${insumo.nombre}" desactivado` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── POST — Registrar movimiento ───────────────────────────────
// ✅ FIX: params era undefined porque faltaba await en Next.js 15
// Esto causaba que insumoId llegara como undefined a Prisma.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Awaiteamos params antes de usar id
    const { id: insumoId } = await params;

    const { granjaId, usuarioId, rol } = await getGranjaId();

    // Control de acceso
    if (rol === 'OPERARIO') {
      const permiso = await prisma.permisoOperario.findUnique({
        where: { granjaId_usuarioId: { granjaId, usuarioId } },
      });
      if (!permiso?.activo) {
        return NextResponse.json(
          { success: false, error: 'No tienes permiso para modificar el inventario. Solicítalo al administrador.' },
          { status: 403 }
        );
      }
    } else if (rol !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 });
    }

    // Verificar que el insumo existe y pertenece a la granja
    const insumo = await prisma.insumoInventario.findFirst({
      where: { id: insumoId, granjaId, activo: true },
    });

    if (!insumo) {
      return NextResponse.json(
        { success: false, error: 'Insumo no encontrado o inactivo' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const val  = movimientoSchema.safeParse(body);

    if (!val.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: val.error.issues },
        { status: 400 }
      );
    }

    const { tipo, cantidad, precioUnitario, observaciones } = val.data;

    // Verificar stock suficiente para salidas
    if (tipo === 'SALIDA') {
      const stockActual = Number(insumo.stockActual);
      if (stockActual < cantidad) {
        return NextResponse.json(
          {
            success: false,
            error: `Stock insuficiente. Disponible: ${stockActual} ${insumo.unidad}`,
          },
          { status: 422 }
        );
      }
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Crear el movimiento con insumoId explícito y verificado
      const movimiento = await tx.movimientoInsumo.create({
        data: {
          tipo,
          cantidad,
          precioUnitario: precioUnitario ?? null,
          observaciones:  observaciones  ?? null,
          insumoId,   // ✅ ya es un string válido gracias al await params
          usuarioId,
        },
        include: {
          usuario: { select: { id: true, nombre: true, rol: true } },
          insumo:  { select: { nombre: true, unidad: true } },
        },
      });

      // 2. Actualizar stockActual atómicamente
      const nuevoStock = await tx.insumoInventario.update({
        where: { id: insumoId },
        data: {
          stockActual: tipo === 'ENTRADA'
            ? { increment: cantidad }
            : { decrement: cantidad },
        },
      });

      return { movimiento, nuevoStock };
    });

    return NextResponse.json(
      {
        success: true,
        message: `${tipo === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada exitosamente`,
        data:    resultado,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}