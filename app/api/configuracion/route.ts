import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { configuracionGranjaSchema } from '@/lib/validations/schemas';

// GET - Obtener configuración de granja del usuario
export async function GET(_request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const configuracion = await prisma.configuracionGranja.findUnique({
      where: { usuarioId: session.user.id }
    });

    return NextResponse.json({
      success: true,
      data: configuracion
    });

  } catch (error) {
    console.error('Error al obtener configuración:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener configuración' },
      { status: 500 }
    );
  }
}

// POST - Crear configuración de granja
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Verificar si ya existe configuración
    const configExistente = await prisma.configuracionGranja.findUnique({
      where: { usuarioId: session.user.id }
    });

    if (configExistente) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una configuración. Usa PUT para actualizar' },
        { status: 409 }
      );
    }

    const body = await request.json();

    // Validar datos
    const validacion = configuracionGranjaSchema.safeParse(body);
    
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

    const { nombreGranja, numeroGallinas } = validacion.data;

    const nuevaConfig = await prisma.configuracionGranja.create({
      data: {
        nombreGranja,
        numeroGallinas,
        usuarioId: session.user.id
      }
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Configuración creada exitosamente',
        data: nuevaConfig
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error al crear configuración:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear configuración' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar configuración de granja
export async function PUT(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const configExistente = await prisma.configuracionGranja.findUnique({
      where: { usuarioId: session.user.id }
    });

    if (!configExistente) {
      return NextResponse.json(
        { success: false, error: 'No existe configuración. Usa POST para crear' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validar datos
    const validacion = configuracionGranjaSchema.safeParse(body);
    
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

    const { nombreGranja, numeroGallinas } = validacion.data;

    const configActualizada = await prisma.configuracionGranja.update({
      where: { usuarioId: session.user.id },
      data: {
        nombreGranja,
        numeroGallinas
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      data: configActualizada
    });

  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar configuración' },
      { status: 500 }
    );
  }
}