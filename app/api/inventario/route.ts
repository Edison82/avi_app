import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const HUEVOS_POR_CUBETA = 30;

// Todas las categorías en orden canónico — siempre devolvemos las 6
const TODAS_CATEGORIAS = ['JUMBO', 'AAA', 'AA', 'A', 'B', 'C'] as const;
type CategoriaHuevo = typeof TODAS_CATEGORIAS[number];

// ── GET — Stock actual de huevos por categoría ────────────────
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
      // Sin granja: devolver 6 categorías vacías
      const vacio = TODAS_CATEGORIAS.map((cat) => ({
        categoriaHuevo:  cat,
        cantidadHuevos:  0,
        cantidadCubetas: 0,
        updatedAt:       null,
      }));
      return NextResponse.json({
        success:      true,
        data:         vacio,
        totalHuevos:  0,
        totalCubetas: 0,
      });
    }

    // Leer filas existentes en InventarioHuevos
    const filas = await prisma.inventarioHuevos.findMany({
      where:   { granjaId },
      orderBy: { categoriaHuevo: 'asc' },
    });

    // Construir un mapa para lookup rápido
    const mapa = new Map(filas.map((f) => [f.categoriaHuevo as CategoriaHuevo, f]));

    // Garantizar las 6 categorías aunque no tengan fila en BD
    const data = TODAS_CATEGORIAS.map((cat) => {
      const fila     = mapa.get(cat);
      const huevos   = fila ? Number(fila.cantidadHuevos) : 0;
      const cubetas  = Math.floor(huevos / HUEVOS_POR_CUBETA);
      return {
        categoriaHuevo:  cat,
        cantidadHuevos:  huevos,
        cantidadCubetas: cubetas,
        updatedAt:       fila?.updatedAt?.toISOString() ?? null,
      };
    });

    const totalHuevos  = data.reduce((s, d) => s + d.cantidadHuevos, 0);
    const totalCubetas = Math.floor(totalHuevos / HUEVOS_POR_CUBETA);

    return NextResponse.json({
      success: true,
      data,
      totalHuevos,
      totalCubetas,
    });
  } catch (error) {
    console.error('Error al obtener inventario de huevos:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener inventario' },
      { status: 500 }
    );
  }
}