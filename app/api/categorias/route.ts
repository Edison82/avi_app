import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { categoriaSchema } from '@/lib/validations/schemas';

// GET - Obtener todas las categorías activas
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
    const incluirInactivas = searchParams.get('incluirInactivas') === 'true';

    const where = incluirInactivas ? {} : { activa: true };

    const categorias = await prisma.categoria.findMany({
      where,
      orderBy: {
        nombre: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      data: categorias
    });

  } catch (error) {
    console.error('Error al obtener categorías:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener categorías' },
      { status: 500 }
    );
  }
}

// POST - Crear nueva categoría (solo ADMIN)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Verificar rol de administrador
    if (session.user.rol !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para crear categorías' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validar datos
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

    // Verificar si ya existe una categoría con ese nombre
    const categoriaExistente = await prisma.categoria.findUnique({
      where: { nombre }
    });

    if (categoriaExistente) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una categoría con ese nombre' },
        { status: 409 }
      );
    }

    const nuevaCategoria = await prisma.categoria.create({
      data: {
        nombre,
        descripcion
      }
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Categoría creada exitosamente',
        data: nuevaCategoria
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error al crear categoría:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear categoría' },
      { status: 500 }
    );
  }
}