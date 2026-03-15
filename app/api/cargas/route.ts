import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getGranjaId } from '@/lib/getGranjaId';

const HUEVOS_POR_CUBETA = 30;

const cargaSchema = z.object({
  categoriaHuevo: z.enum(['JUMBO', 'AAA', 'AA', 'A', 'B', 'C'] as const),
  cubetas:        z.coerce.number().int().min(1, 'Mínimo 1 cubeta'),
  observaciones:  z.string().optional(),
});

// ── GET — Cargas del conductor con paginación ────────────────
export async function GET(request: Request) {
  try {
    const { granjaId, usuarioId, rol } = await getGranjaId();

    const { searchParams } = new URL(request.url);
    const limite = Math.max(1, parseInt(searchParams.get('limite') || '10'));
    const pagina = Math.max(1, parseInt(searchParams.get('pagina') || '1'));

    // Admin ve todas; conductor solo las suyas
    const where = rol === 'ADMIN'
      ? { granjaId }
      : { granjaId, conductorId: usuarioId };

    const [cargas, total] = await Promise.all([
      prisma.cargaConductor.findMany({
        where,
        include: {
          conductor: { select: { id: true, nombre: true, email: true } },
        },
        orderBy: { fecha: 'desc' },
        skip:    (pagina - 1) * limite,
        take:    limite,
      }),
      prisma.cargaConductor.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data:    cargas,
      pagination: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite) || 1,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

// ── POST — Registrar carga, descontar InventarioHuevos ───────
export async function POST(request: Request) {
  try {
    const { granjaId, usuarioId, rol } = await getGranjaId();

    if (rol !== 'CONDUCTOR' && rol !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para registrar cargas' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const val  = cargaSchema.safeParse(body);

    if (!val.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: val.error.issues },
        { status: 400 }
      );
    }

    const { categoriaHuevo, cubetas, observaciones } = val.data;
    const huevosEquivalentes = cubetas * HUEVOS_POR_CUBETA;

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Verificar stock suficiente en InventarioHuevos
      const stock = await tx.inventarioHuevos.findUnique({
        where: { granjaId_categoriaHuevo: { granjaId, categoriaHuevo } },
      });

      const stockActual = stock ? Number(stock.cantidadHuevos) : 0;

      if (stockActual < huevosEquivalentes) {
        const cubetasDisp = Math.floor(stockActual / HUEVOS_POR_CUBETA);
        throw new Error(
          `Stock insuficiente. Disponible: ${cubetasDisp} cubetas (${stockActual} huevos) de categoría ${categoriaHuevo}`
        );
      }

      // 2. Descontar del inventario
      await tx.inventarioHuevos.upsert({
        where:  { granjaId_categoriaHuevo: { granjaId, categoriaHuevo } },
        update: { cantidadHuevos: { decrement: huevosEquivalentes } },
        create: { granjaId, categoriaHuevo, cantidadHuevos: 0 },
      });

      // 3. Crear registro de carga
      const carga = await tx.cargaConductor.create({
        data: {
          categoriaHuevo,
          cubetas,
          huevosEquivalentes,
          observaciones,
          granjaId,
          conductorId: usuarioId,
        },
        include: {
          conductor: { select: { id: true, nombre: true, email: true, rol: true } },
        },
      });

      return carga;
    });

    return NextResponse.json(
      {
        success: true,
        message: `Carga registrada: ${cubetas} cubetas de ${categoriaHuevo} (${huevosEquivalentes} huevos descontados del inventario)`,
        data:    resultado,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    const status  = message.startsWith('Stock insuficiente') ? 422 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}