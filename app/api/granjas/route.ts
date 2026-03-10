import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { granjaSchema } from '@/lib/validations/schemas';

// GET - Obtener granjas del usuario
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    let granjas;

    if (session.user.rol === 'ADMIN') {
      granjas = await prisma.granja.findMany({
        where: { adminId: session.user.id },
        include: {
          _count: {
            select: { usuarios: true, registros: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      const asignaciones = await prisma.usuarioGranja.findMany({
        where: { usuarioId: session.user.id },
        include: {
          granja: {
            include: {
              _count: {
                select: { usuarios: true, registros: true },
              },
            },
          },
        },
      });

      granjas = asignaciones.map((a) => a.granja);
    }

    return NextResponse.json({
      success: true,
      data: granjas,
    });
  } catch (error) {
    console.error('Error al obtener granjas:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener granjas' },
      { status: 500 }
    );
  }
}

// POST - Crear nueva granja (solo ADMIN)
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (session.user.rol !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Solo administradores pueden crear granjas' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validacion = granjaSchema.safeParse(body);

    if (!validacion.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: validacion.error,
        },
        { status: 400 }
      );
    }

    const { nombre, numeroAves, fechaIngreso } = validacion.data;
    const slug =
      nombre.toLowerCase().replace(/ /g, '-') + '-' + Date.now();

    const nuevaGranja = await prisma.granja.create({
      data: {
        nombre,
        slug,
        numeroAves,
        fechaIngreso: new Date(fechaIngreso),
        adminId: session.user.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Granja creada exitosamente',
        data: nuevaGranja,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error al crear granja:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear granja' },
      { status: 500 }
    );
  }
}
