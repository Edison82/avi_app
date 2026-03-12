import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {

  const session = await auth()

  if (!session?.user || session.user.rol !== 'ADMIN') {
    return NextResponse.json({ success: false }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json()

  const usuario = await prisma.usuario.update({
    where: { id },
    data: {
      activo: body.activo
    }
  })

  return NextResponse.json({
    success: true,
    data: usuario
  })
}