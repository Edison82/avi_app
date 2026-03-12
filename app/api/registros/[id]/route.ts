import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registroDiarioSchema } from "@/lib/validations/schemas";

// Helper para validar sesión y granjaId (limpia el código repetido)
async function getValidatedSession() {
  const session = await auth();
  if (!session?.user?.granjaId) return null;
  return session;
}

// GET - Obtener un registro específico
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getValidatedSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const granjaId = session.user.granjaId;

    if (!granjaId) {
      return NextResponse.json(
        { success: false, error: "ID de granja no encontrado" },
        { status: 400 }
      );
    }

    const registro = await prisma.registroDiario.findFirst({
      where: {
        id: params.id,
        granjaId: granjaId, // PROTECCIÓN: Solo de su granja
      },
      include: {
        gastos: {
          include: { categoria: true },
        },
      },
    });

    if (!registro) {
      return NextResponse.json(
        { success: false, error: "Registro no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: registro });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 }
    );
  }
}

// PUT - Actualizar registro
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getValidatedSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const granjaId = session.user.granjaId;

    if (!granjaId) {
      return NextResponse.json(
        { success: false, error: "ID de granja no encontrado" },
        { status: 400 }
      );
    }

    // 1. Verificar existencia y pertenencia
    const registroExistente = await prisma.registroDiario.findFirst({
      where: {
        id: params.id,
        granjaId: granjaId, // PROTECCIÓN
      },
    });

    if (!registroExistente) {
      return NextResponse.json(
        { success: false, error: "Registro no encontrado" },
        { status: 404 }
      );
    }

    // 2. Validar Body
    const body = await request.json();
    const validacion = registroDiarioSchema.safeParse(body);

    if (!validacion.success) {
      return NextResponse.json(
        { success: false, details: validacion.error.issues },
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
    const ingresoTotal = huevosVendidos * precioVentaUnitario;

    // 3. Transacción para actualizar (Borra gastos viejos y crea nuevos)
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
          gastos: {
            create: (gastos ?? []).map((g) => ({
              descripcion: g.descripcion,
              monto: g.monto,
              categoriaId: g.categoriaId,
            })),
          },
        },
        include: { gastos: { include: { categoria: true } } },
      });
    });

    return NextResponse.json({ success: true, data: registroActualizado });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar registro
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getValidatedSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const granjaId = session.user.granjaId;

    if (!granjaId) {
      return NextResponse.json(
        { success: false, error: "ID de granja no encontrado" },
        { status: 400 }
      );
    }

    // Eliminamos asegurando que el ID del registro Y el ID de la granja coincidan
    // Esto evita que alguien borre registros ajenos
    const resultado = await prisma.registroDiario.deleteMany({
      where: {
        id: params.id,
        granjaId: granjaId,
      },
    });

    if (resultado.count === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No se encontró el registro o no tienes permiso",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Eliminado correctamente",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error al eliminar" },
      { status: 500 }
    );
  }
}
