import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const setupSchema = z.object({
  nombreGranja: z.string().min(3),
  numeroAves: z.coerce.number().int().min(1),
  fechaIngreso: z.string(),
});

// Genera slug único a partir del nombre
function generarSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rol !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Verificar que no tenga ya granja
    const granjaExistente = await prisma.granja.findUnique({
      where: { adminId: session.user.id }
    });
    if (granjaExistente) {
      return NextResponse.json({ success: false, error: 'Ya tienes una granja configurada' }, { status: 409 });
    }

    const body = await request.json();
    const validacion = setupSchema.safeParse(body);
    if (!validacion.success) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 });
    }

    const { nombreGranja, numeroAves, fechaIngreso } = validacion.data;

    // Generar slug único
    let slug = generarSlug(nombreGranja);
    const slugExistente = await prisma.granja.findUnique({ where: { slug } });
    if (slugExistente) {
      slug = `${slug}-${Date.now()}`;
    }

    const granja = await prisma.granja.create({
      data: {
        nombre: nombreGranja,
        slug,
        numeroAves,
        fechaIngreso: new Date(fechaIngreso),
        adminId: session.user.id,
      }
    });

    // Crear categorías por defecto para esta granja
    const categoriasPorDefecto = ['Alimento', 'Medicinas', 'Mano de Obra', 'Servicios', 'Mantenimiento', 'Otros'];
    await prisma.categoria.createMany({
      data: categoriasPorDefecto.map(nombre => ({
        nombre,
        granjaId: granja.id,
      }))
    });

    return NextResponse.json({
      success: true,
      message: 'Granja configurada exitosamente',
      data: { granjaId: granja.id, slug }
    }, { status: 201 });

  } catch (error) {
    console.error('Error al configurar granja:', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}