import { auth } from "@/lib/auth"

export async function getGranjaId() {
  const session = await auth()

  // Validación de seguridad
  if (!session?.user) {
    throw new Error("No autenticado")
  }

  const granjaId = session.user.granjaId;
  const usuarioId = session.user.id;
  const rol = session.user.rol;

  // Forzamos la comprobación para que TypeScript no de errores de 'null' después
  if (!granjaId) {
    throw new Error("Usuario sin granja")
  }

  return {
    granjaId, // Aquí ya es string garantizado
    usuarioId,
    rol
  }
}