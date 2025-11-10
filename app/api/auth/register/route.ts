import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registroUsuarioSchema } from '@/lib/validations/schemas';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validar datos con Zod
    const validacion = registroUsuarioSchema.safeParse(body);
    
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

    const { nombre, email, password } = validacion.data;

    // Verificar si el email ya existe
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email }
    });

    if (usuarioExistente) {
      return NextResponse.json(
        { success: false, error: 'El email ya está registrado' },
        { status: 409 }
      );
    }

    // Hashear contraseña
    const passwordHash = await hash(password, 12);

    // Crear usuario
    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        password: passwordHash,
        rol: 'OPERARIO', // Por defecto OPERARIO
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        createdAt: true,
      }
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Usuario creado exitosamente',
        data: nuevoUsuario
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error al registrar usuario:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}