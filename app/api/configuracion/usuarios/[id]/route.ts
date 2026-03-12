import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {

    const session = await auth()

    if (!session?.user || session.user.rol !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }

    const { id } = await context.params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      )
    }

    // 🔒 VERIFICAR QUE EL USUARIO PERTENEZCA A ESTE ADMIN
    const usuario = await prisma.usuario.findFirst({
      where: {
        id,
        creadoPorId: session.user.id
      }
    })

    if (!usuario) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // 🗑 ELIMINAR
    await prisma.usuario.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Usuario eliminado correctamente'
    })

  } catch (error) {

    console.error(error)

    return NextResponse.json(
      { success: false, error: 'Error al eliminar usuario' },
      { status: 500 }
    )
  }
}