import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - Obtener gastos de un registro específico
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const registroId = searchParams.get('registroId');

    if (!registroId) {
      return NextResponse.json(
        { success: false, error: 'registroId es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el registro pertenece al usuario
    const registro = await prisma.registroDiario.findFirst({
      where: {
        id: registroId,
        usuarioId: session.user.id
      }
    });

    if (!registro) {
      return NextResponse.json(
        { success: false, error: 'Registro no encontrado' },
        { status: 404 }
      );
    }

    const gastos = await prisma.gasto.findMany({
      where: { registroId },
      include: {
        categoria: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      data: gastos
    });

  } catch (error) {
    console.error('Error al obtener gastos:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener gastos' },
      { status: 500 }
    );
  }
}