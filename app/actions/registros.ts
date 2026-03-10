import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function crearRegistro(data: FormData) {
  const session = await auth();

  if (!session?.user) {
    return { success: false, error: "No autenticado" };
  }

  const fecha = data.get("fecha") as string;
  const huevos = Number(data.get("huevos"));
  const granjaId = session.user.granjaId;

  if (!granjaId) {
    return { success: false, error: "No tienes una granja asignada" };
  }

  try {
    const registro = await prisma.registroDiario.create({
      data: {
        fecha: new Date(`${fecha}T00:00:00`),
        huevosProducidos: huevos,
        huevosVendidos: 0,
        precioVentaUnitario: 0,
        ingresoTotal: 0,
        granjaId,
        usuarioId: session.user.id,
      },
    });

    revalidatePath("/dashboard");
    return { success: true, registro };
  } catch (error) {
    console.error("Error al crear registro:", error);
    return { success: false, error: "Error al crear registro" };
  }
}
