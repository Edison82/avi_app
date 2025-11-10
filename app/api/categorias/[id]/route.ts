import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { categoriaSchema } from '@/lib/validations/schemas';

// PUT - Actualizar categoría (solo ADMIN)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (session.user.rol !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para editar categorías' },
        { status: 403 }
      );
    }

    const categoriaExistente = await prisma.categoria.findUnique({
      where: { id: params.id }
    });

    if (!categoriaExistente) {
      return NextResponse.json(
        { success: false, error: 'Categoría no encontrada' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validacion = categoriaSchema.safeParse(body);
    
    if (!validacion.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Datos inválidos',
          details: validacion.error.issues
        },
        { status: 400 }
      );
    }

    const { nombre, descripcion } = validacion.data;

    const categoriaActualizada = await prisma.categoria.update({
      where: { id: params.id },
      data: {
        nombre,
        descripcion
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Categoría actualizada exitosamente',
      data: categoriaActualizada
    });

  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar categoría' },
      { status: 500 }
    );
  }
}

// PATCH - Activar/Desactivar categoría (solo ADMIN)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (session.user.rol !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos' },
        { status: 403 }
      );
    }

    const categoriaExistente = await prisma.categoria.findUnique({
      where: { id: params.id }
    });

    if (!categoriaExistente) {
      return NextResponse.json(
        { success: false, error: 'Categoría no encontrada' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { activa } = body;

    if (typeof activa !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'El campo activa debe ser un booleano' },
        { status: 400 }
      );
    }

    const categoriaActualizada = await prisma.categoria.update({
      where: { id: params.id },
      data: { activa }
    });

    return NextResponse.json({
      success: true,
      message: `Categoría ${activa ? 'activada' : 'desactivada'} exitosamente`,
      data: categoriaActualizada
    });

  } catch (error) {
    console.error('Error al cambiar estado de categoría:', error);
    return NextResponse.json(
      { success: false, error: 'Error al cambiar estado' },
      { status: 500 }
    );
  }
}