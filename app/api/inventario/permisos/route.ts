import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getGranjaId } from '@/lib/getGranjaId';

const permisoSchema = z.object({
  usuarioId: z.string().uuid(),
  activo:    z.boolean(),
});

// ── GET — Lista de operarios con su estado de permiso ────────
export async function GET() {
  try {
    const { granjaId, rol } = await getGranjaId();

    if (rol !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 });
    }

    // Traer todos los operarios asignados a la granja
    const usuariosGranja = await prisma.usuarioGranja.findMany({
      where: { granjaId },
      include: {
        usuario: {
          select: { id: true, nombre: true, email: true, rol: true, activo: true },
        },
      },
    });

    // Solo operarios
    const operarios = usuariosGranja
      .map((ug) => ug.usuario)
      .filter((u) => u.rol === 'OPERARIO');

    // Traer permisos existentes
    const permisos = await prisma.permisoOperario.findMany({
      where: { granjaId },
    });

    const permisoMap = new Map(permisos.map((p) => [p.usuarioId, p.activo]));

    const data = operarios.map((op) => ({
      ...op,
      permisoInventario: permisoMap.get(op.id) ?? false,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

// ── POST — Activar o desactivar permiso de un operario ───────
export async function POST(request: Request) {
  try {
    const { granjaId, rol } = await getGranjaId();

    if (rol !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 });
    }

    const body = await request.json();
    const val  = permisoSchema.safeParse(body);

    if (!val.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: val.error.issues },
        { status: 400 }
      );
    }

    const { usuarioId, activo } = val.data;

    // Verificar que el usuario es un OPERARIO de esta granja
    const usuarioGranja = await prisma.usuarioGranja.findUnique({
      where: { usuarioId_granjaId: { usuarioId, granjaId } },
      include: { usuario: { select: { rol: true } } },
    });

    if (!usuarioGranja || usuarioGranja.usuario.rol !== 'OPERARIO') {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado o no es operario' },
        { status: 404 }
      );
    }

    const permiso = await prisma.permisoOperario.upsert({
      where:  { granjaId_usuarioId: { granjaId, usuarioId } },
      update: { activo },
      create: { granjaId, usuarioId, activo },
    });

    return NextResponse.json({
      success: true,
      message: activo
        ? 'Permiso de inventario otorgado'
        : 'Permiso de inventario revocado',
      data: permiso,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}