import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { z } from 'zod';

const crearUsuarioSchema = z.object({
  nombre: z.string().min(3, 'Mínimo 3 caracteres'),
  identificador: z.string().min(2, 'Mínimo 2 caracteres').regex(/^[a-z0-9]+$/, 'Solo letras minúsculas y números'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  rol: z.enum(['OPERARIO', 'CONDUCTOR']),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.rol !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    const granja = await prisma.granja.findUnique({
      where: { adminId: session.user.id },
      select: { id: true }
    });

    const usuarios = await prisma.usuario.findMany({
      where: {
        granjas: {
          some: {
            granjaId: granja?.id
          }
        }
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, data: usuarios });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error al obtener usuarios' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rol !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    const granja = await prisma.granja.findUnique({
      where: { adminId: session.user.id }
    });
    if (!granja) {
      return NextResponse.json({ success: false, error: 'Configura tu granja primero' }, { status: 400 });
    }

    const body = await request.json();
    const validacion = crearUsuarioSchema.safeParse(body);
    if (!validacion.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: validacion.error.issues },
        { status: 400 }
      );
    }

    const { nombre, identificador, password, rol } = validacion.data;

    // Email generado automáticamente: identificador.rol@slug-granja.avi
    const email = `${identificador}.${rol.toLowerCase()}@${granja.slug}.avi`;

    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      return NextResponse.json(
        { success: false, error: `El identificador "${identificador}" ya está en uso para este rol` },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        password: passwordHash,
        rol,
        creadoPorId: session.user.id,
        granjas: {
          create: {
            granja: {
              connect: { id: granja.id }
            }
          }
        }
      },
      select: { id: true, nombre: true, email: true, rol: true, createdAt: true }
});
    return NextResponse.json({
      success: true,
      message: `${rol === 'OPERARIO' ? 'Operario' : 'Conductor'} creado exitosamente`,
      data: {
        ...nuevoUsuario,
        credenciales: { email, password } // Para mostrarle al admin
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error al crear usuario:', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}