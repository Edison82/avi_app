import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const entregaSchema = z.object({
  fecha: z.string(),
  huevosEntregados: z.coerce.number().int().min(1),
  precioVentaUnitario: z.coerce.number().min(0),
  clienteNombre: z.string().optional(),
  observaciones: z.string().optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const granjaId = session.user.granjaId;

    if (!granjaId) {
      return NextResponse.json(
        { success: false, error: 'No estás asignado a ninguna granja' },
        { status: 400 }
      );
    }

    const entregas = await prisma.entregaConductor.findMany({
      where: { granjaId }, // ahora es string seguro
      include: {
        conductor: {
          select: { nombre: true }
        }
      },
      orderBy: { fecha: 'desc' }
    });

    return NextResponse.json({ success: true, data: entregas });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Error al obtener entregas' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rol !== 'CONDUCTOR') {
      return NextResponse.json({ success: false, error: 'Solo conductores pueden registrar entregas' }, { status: 403 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: session.user.id },
      include: { granjas: true }
    });
    
    if (!usuario || usuario.granjas.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No estás asignado a ninguna granja' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validacion = entregaSchema.safeParse(body);
    if (!validacion.success) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 });
    }

    const { fecha, huevosEntregados, precioVentaUnitario, clienteNombre, observaciones } = validacion.data;
    const ingresoTotal = huevosEntregados * precioVentaUnitario;

    const granjaId = usuario.granjas[0].granjaId;
        if (!granjaId) {
        return NextResponse.json(
    { success: false, error: 'No estás asignado a ninguna granja' },
    { status: 400 }
  );
}

const entrega = await prisma.entregaConductor.create({
  data: {
    fecha: new Date(fecha),
    huevosEntregados,
    precioVentaUnitario,
    ingresoTotal,
    clienteNombre,
    observaciones,
    granjaId,
    conductorId: session.user.id,
  }
});

    return NextResponse.json({ success: true, data: entrega }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error al registrar entrega' }, { status: 500 });
  }
}