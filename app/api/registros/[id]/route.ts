import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registroDiarioSchema } from '@/lib/validations/schemas';
import { getGranjaId } from '@/lib/getGranjaId';

// GET - Obtener un registro específico
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
        gastos: { include: { categoria: true } },
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

// PUT - Actualizar registro
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
      return NextResponse.json({ success: false, details: validacion.error.issues }, { status: 400 });
    }

    const { fecha, huevosProducidos, huevosVendidos, precioVentaUnitario, observaciones, mortalidad, gastos } = validacion.data;
    const ingresoTotal = huevosVendidos * precioVentaUnitario;

    const registroActualizado = await prisma.$transaction(async (tx) => {
      await tx.gastoDiario.deleteMany({ where: { registroId: params.id } });
      return tx.registroDiario.update({
        where: { id: params.id },
        data: {
          fecha: new Date(`${fecha}T00:00:00`),
          huevosProducidos,
          huevosVendidos,
          precioVentaUnitario,
          ingresoTotal,
          observaciones,
          mortalidad: mortalidad ?? 0,
          gastos: {
            create: (gastos ?? []).map((g) => ({
              descripcion: g.descripcion,
              monto:       g.monto,
              categoriaId: g.categoriaId,
            })),
          },
        },
        include: {
          gastos: { include: { categoria: true } },
          usuario: { select: { id: true, nombre: true, email: true, rol: true } },
        },
      });
    });

    return NextResponse.json({ success: true, data: registroActualizado });
  } catch (error) {
    console.error('Error al actualizar registro:', error);
    return NextResponse.json({ success: false, error: 'Error al actualizar' }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
// BUG RAÍZ: deleteMany({ where: { id, granjaId } }) devuelve count=0 cuando
// params.id llega como undefined (ruta mal configurada), pero si granjaId es
// el único filtro que matchea, borra TODOS los registros de la granja.
//
// FIX en 2 pasos:
//   1. findFirst con id + granjaId → 404 si no existe o no pertenece
//   2. delete({ where: { id } }) sobre PK exacta → máximo 1 fila borrada
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { granjaId } = await getGranjaId();
    if (!granjaId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    // Paso 1: verificar existencia Y pertenencia a la granja
    const registro = await prisma.registroDiario.findFirst({
      where: { id: params.id, granjaId },
      select: { id: true },
    });

    if (!registro) {
      return NextResponse.json(
        { success: false, error: 'No se encontró el registro o no tienes permiso' },
        { status: 404 }
      );
    }

    // Paso 2: delete por PK — nunca borra más de 1 registro
    await prisma.registroDiario.delete({
      where: { id: registro.id },
    });

    return NextResponse.json({ success: true, message: 'Registro eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar registro:', error);
    return NextResponse.json({ success: false, error: 'Error al eliminar' }, { status: 500 });
  }
}