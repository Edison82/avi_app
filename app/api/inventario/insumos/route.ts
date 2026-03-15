import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getGranjaId } from '@/lib/getGranjaId';

const insumoSchema = z.object({
  nombre:      z.string().min(1, 'Nombre requerido'),
  descripcion: z.string().optional(),
  unidad:      z.string().min(1, 'Unidad requerida').default('unidad'),
  stockMinimo: z.coerce.number().min(0).default(0),
});

// ── GET — Catálogo de insumos con stock actual ────────────────
export async function GET() {
  try {
    const { granjaId } = await getGranjaId();

    const insumos = await prisma.insumoInventario.findMany({
      where:   { granjaId },
      orderBy: { nombre: 'asc' },
    });

    return NextResponse.json({ success: true, data: insumos });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

// ── POST — Crear nuevo insumo (solo ADMIN) ───────────────────
export async function POST(request: Request) {
  try {
    const { granjaId, rol } = await getGranjaId();

    if (rol !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Solo el administrador puede crear insumos' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const val  = insumoSchema.safeParse(body);

    if (!val.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: val.error.issues },
        { status: 400 }
      );
    }

    const { nombre, descripcion, unidad, stockMinimo } = val.data;

    // Verificar que no existe otro insumo con ese nombre en esta granja
    const existente = await prisma.insumoInventario.findUnique({
      where: { granjaId_nombre: { granjaId, nombre } },
    });

    if (existente) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un insumo con ese nombre' },
        { status: 409 }
      );
    }

    const insumo = await prisma.insumoInventario.create({
      data: { nombre, descripcion, unidad, stockMinimo, granjaId },
    });

    return NextResponse.json(
      { success: true, message: 'Insumo creado exitosamente', data: insumo },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}