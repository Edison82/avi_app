import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getGranjaId } from "@/lib/getGranjaId";

const entregaSchema = z.object({
  fecha: z.string(),
  huevosEntregados: z.coerce.number().int().min(1),
  precioVentaUnitario: z.coerce.number().min(0),
  clienteNombre: z.string().optional(),
  observaciones: z.string().optional(),
});

// GET - Obtener entregas de la granja
export async function GET() {
  try {
    // 1. Obtenemos todo lo necesario del helper
    // Si no hay sesión o granja, getGranjaId() lanzará un error que caerá en el catch
    const { granjaId } = await getGranjaId();

    const entregas = await prisma.entregaConductor.findMany({
      where: { granjaId },
      include: {
        conductor: {
          select: { nombre: true },
        },
      },
      orderBy: { fecha: 'desc' },
    });

    return NextResponse.json({ success: true, data: entregas });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error('Error al obtener entregas:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status:  400 }
    );
  }
}

// POST - Registrar nueva entrega
export async function POST(request: Request) {
  try {
    // 1. Validar identidad y granja con el helper
    const { granjaId, usuarioId, rol } = await getGranjaId();

    // 2. Control de acceso por Rol (Opcional: puedes permitir a ADMIN también)
    if (rol !== 'CONDUCTOR' && rol !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para registrar entregas' },
        { status: 403 }
      );
    }

    // 3. Validar el cuerpo de la petición
    const body = await request.json();
    const validacion = entregaSchema.safeParse(body);
    
    if (!validacion.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: validacion.error.issues },
        { status: 400 }
      );
    }

    const { fecha, huevosEntregados, precioVentaUnitario, clienteNombre, observaciones } = validacion.data;
    const ingresoTotal = huevosEntregados * precioVentaUnitario;

    // 4. Crear registro (Usamos los datos garantizados por getGranjaId)
    const entrega = await prisma.entregaConductor.create({
      data: {
        fecha: new Date(fecha),
        huevosEntregados,
        precioVentaUnitario,
        ingresoTotal,
        clienteNombre,
        observaciones,
        granjaId: granjaId, // Ya es string seguro
        conductorId: usuarioId,
      },
    });

    return NextResponse.json({ success: true, data: entrega }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error('Error al registrar entrega:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}