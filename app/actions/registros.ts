import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { success } from "zod";

export async function crearRegistro(data: FormData) {
    const registro = await Prisma.registroDiario.create({
        data: {
            fecha: new Date(data.get('fecha')),
            huevosProducidos: Number(data.get('huevos')),
        }
    });

    revalidatePath('/dashboard');
    return { success: true, registro};
}