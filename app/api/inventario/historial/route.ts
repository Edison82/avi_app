import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGranjaId } from '@/lib/getGranjaId';

// ── GET — Historial unificado: movimientos de insumos + cargas del conductor ──
export async function GET(request: Request) {
  try {
    const { granjaId, rol } = await getGranjaId();

    if (rol !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limite = Math.max(1, parseInt(searchParams.get('limite') || '15'));
    const pagina = Math.max(1, parseInt(searchParams.get('pagina') || '1'));
    const tipo   = searchParams.get('tipo'); // 'INSUMO' | 'CARGA' | null (todos)

    // ── Movimientos de insumos ──────────────────────────────
    const movimientosInsumo = tipo === 'CARGA' ? [] : await prisma.movimientoInsumo.findMany({
      where: { insumo: { granjaId } },
      include: {
        usuario: { select: { id: true, nombre: true, rol: true } },
        insumo:  { select: { id: true, nombre: true, unidad: true } },
      },
      orderBy: { fecha: 'desc' },
    });

    // ── Cargas del conductor ────────────────────────────────
    const cargas = tipo === 'INSUMO' ? [] : await prisma.cargaConductor.findMany({
      where: { granjaId },
      include: {
        conductor: { select: { id: true, nombre: true, rol: true } },
      },
      orderBy: { fecha: 'desc' },
    });

    // ── Unificar en formato común ───────────────────────────
    type EntradaHistorial = {
      id:           string;
      tipo:         'INSUMO_ENTRADA' | 'INSUMO_SALIDA' | 'CARGA_CONDUCTOR';
      fecha:        string;
      descripcion:  string;
      cantidad:     number;
      unidad:       string;
      usuario:      { id: string; nombre: string; rol: string };
      extra?:       Record<string, unknown>;
    };

    const historial: EntradaHistorial[] = [
      ...movimientosInsumo.map((m) => ({
        id:          m.id,
        tipo:        (m.tipo === 'ENTRADA' ? 'INSUMO_ENTRADA' : 'INSUMO_SALIDA') as EntradaHistorial['tipo'],
        fecha:       m.fecha.toISOString(),
        descripcion: `${m.tipo === 'ENTRADA' ? 'Entrada' : 'Salida'} de ${m.insumo.nombre}`,
        cantidad:    Number(m.cantidad),
        unidad:      m.insumo.unidad,
        usuario:     m.usuario,
        extra: {
          insumoId:      m.insumoId,
          insumoNombre:  m.insumo.nombre,
          precioUnitario: m.precioUnitario ? Number(m.precioUnitario) : null,
          observaciones: m.observaciones,
        },
      })),
      ...cargas.map((c) => ({
        id:          c.id,
        tipo:        'CARGA_CONDUCTOR' as EntradaHistorial['tipo'],
        fecha:       c.fecha.toISOString(),
        descripcion: `Carga de ${c.cubetas} cubetas categoría ${c.categoriaHuevo}`,
        cantidad:    c.huevosEquivalentes,
        unidad:      'huevo',
        usuario:     c.conductor,
        extra: {
          categoriaHuevo:     c.categoriaHuevo,
          cubetas:            c.cubetas,
          huevosEquivalentes: c.huevosEquivalentes,
          observaciones:      c.observaciones,
        },
      })),
    ];

    // Ordenar por fecha descendente
    historial.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    // Paginar en memoria
    const total        = historial.length;
    const paginados    = historial.slice((pagina - 1) * limite, pagina * limite);
    const totalPaginas = Math.ceil(total / limite) || 1;

    return NextResponse.json({
      success: true,
      data:    paginados,
      pagination: { total, pagina, limite, totalPaginas },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}