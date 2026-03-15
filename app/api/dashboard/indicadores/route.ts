import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGranjaId } from '@/lib/getGranjaId';

// ── Helpers de fechas ─────────────────────────────────────────
function inicioDia(d: Date) {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}

function calcularRango(periodo: string, offset = 0): { desde: Date; hasta: Date; label: string } {
  const ahora = new Date();

  if (periodo === 'hoy') {
    const d = new Date(ahora);
    d.setDate(d.getDate() - offset);
    return { desde: inicioDia(d), hasta: d, label: d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) };
  }

  if (periodo === 'semana') {
    const desde = new Date(ahora);
    desde.setDate(desde.getDate() - 6 - offset * 7);
    inicioDia(desde);
    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + 6);
    return { desde, hasta, label: `Semana del ${desde.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}` };
  }

  if (periodo === 'mes') {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - offset, 1);
    const hasta = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    return { desde: d, hasta, label: d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) };
  }

  if (periodo === 'trimestre') {
    const trimActual = Math.floor(ahora.getMonth() / 3);
    const trimOffset = trimActual - offset;
    const año  = ahora.getFullYear() + Math.floor(trimOffset / 4);
    const trim = ((trimOffset % 4) + 4) % 4;
    const desde = new Date(año, trim * 3, 1);
    const hasta  = new Date(año, trim * 3 + 3, 0, 23, 59, 59);
    return { desde, hasta, label: `T${trim + 1} ${año}` };
  }

  if (periodo === 'semestre') {
    const semActual = ahora.getMonth() < 6 ? 0 : 1;
    const semOffset = semActual - offset;
    const año  = ahora.getFullYear() + (semOffset < 0 ? -1 : 0);
    const sem  = semOffset < 0 ? 1 : semOffset;
    const desde = new Date(año, sem * 6, 1);
    const hasta  = new Date(año, sem * 6 + 6, 0, 23, 59, 59);
    return { desde, hasta, label: `${sem === 0 ? 'Primer' : 'Segundo'} semestre ${año}` };
  }

  if (periodo === 'año') {
    const año = ahora.getFullYear() - offset;
    return { desde: new Date(año, 0, 1), hasta: new Date(año, 11, 31, 23, 59, 59), label: `Año ${año}` };
  }

  // default: hoy
  return calcularRango('hoy', offset);
}

// Agrupa registros en buckets según el período para los gráficos
function formatFechaGrafico(fecha: Date, periodo: string): string {
  if (periodo === 'hoy')      return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  if (periodo === 'semana')   return fecha.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' });
  if (periodo === 'mes')      return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  if (periodo === 'trimestre')return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  if (periodo === 'semestre') return fecha.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
  if (periodo === 'anio')      return fecha.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
  return fecha.toLocaleDateString('es-CO');
}

// ── GET ───────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { granjaId } = await getGranjaId();
    if (!granjaId) {
      return NextResponse.json({ success: false, error: 'No tienes una granja configurada' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const periodo  = searchParams.get('periodo')  || 'hoy';   // hoy|semana|mes|trimestre|semestre|año
    const offset   = parseInt(searchParams.get('offset')  || '0'); // 0=actual, 1=anterior, etc.
    const comparar = searchParams.get('comparar') === 'true';

    // Datos de la granja
    const granja = await prisma.granja.findUnique({
      where: { id: granjaId },
      select: { numeroAves: true },
    });
    const numeroAves = granja?.numeroAves ?? 1;

    // Stock actual de huevos (total sin filtrar por categoría)
    const inventario = await prisma.inventarioHuevos.findMany({ where: { granjaId } });
    const totalHuevosStock  = inventario.reduce((s, i) => s + i.cantidadHuevos, 0);
    const totalCubetasStock = Math.floor(totalHuevosStock / 30);

    // ── Rango principal ──────────────────────────────────────
    const rango = calcularRango(periodo, offset);

    const registros = await prisma.registroDiario.findMany({
      where:   { granjaId, fecha: { gte: rango.desde, lte: rango.hasta } },
      include: { gastos: true },
      orderBy: { fecha: 'asc' },
    });

    const cargas = await prisma.cargaConductor.findMany({
      where:   { granjaId, fecha: { gte: rango.desde, lte: rango.hasta } },
      orderBy: { fecha: 'asc' },
    });

    const entregas = await prisma.entregaConductor.findMany({
      where:   { granjaId, fecha: { gte: rango.desde, lte: rango.hasta } },
      orderBy: { fecha: 'asc' },
    });

    // ── Función de cálculo de métricas ───────────────────────
    function calcularMetricas(regs: typeof registros, cargas_: typeof cargas, entregas_: typeof entregas) {
      const totalProduccion     = regs.reduce((s, r) => s + r.huevosProducidos, 0);
      const totalVendidos       = regs.reduce((s, r) => s + r.huevosVendidos, 0);
      const totalIngresos       = regs.reduce((s, r) => s + Number(r.ingresoTotal), 0);
      const totalGastos         = regs.reduce((s, r) => r.gastos.reduce((g, x) => g + Number(x.monto), 0) + s, 0);
      const totalMortalidad     = regs.reduce((s, r) => s + (r.mortalidad ?? 0), 0);
      const totalHuevosCargados = cargas_.reduce((s, c) => s + c.huevosEquivalentes, 0);
      const totalIngresosEntregas = entregas_.reduce((s, e) => s + Number(e.ingresoTotal), 0);
      const totalHuevosEntregados = entregas_.reduce((s, e) => s + e.huevosEntregados, 0);
      const gananciaNeta        = totalIngresos - totalGastos;
      const dias                = regs.length || 1;
      const tasaPosturaProm     = parseFloat(((totalProduccion / (numeroAves * dias)) * 100).toFixed(2));
      const promedioProduccion  = Math.round(totalProduccion / dias);
      const promedioGanancia    = gananciaNeta / dias;
      const eficienciaVenta     = totalProduccion > 0 ? parseFloat(((totalVendidos / totalProduccion) * 100).toFixed(2)) : 0;

      const graficoDatos = regs.map((r) => {
        const gastoTotal = r.gastos.reduce((s, g) => s + Number(g.monto), 0);
        return {
          fecha:            formatFechaGrafico(new Date(r.fecha), periodo),
          huevosProducidos: r.huevosProducidos,
          huevosVendidos:   r.huevosVendidos,
          ingresoTotal:     Number(r.ingresoTotal),
          gastoTotal,
          ganancia:         Number(r.ingresoTotal) - gastoTotal,
          tasaPostura:      parseFloat(((r.huevosProducidos / numeroAves) * 100).toFixed(2)),
          mortalidad:       r.mortalidad ?? 0,
        };
      });

      return {
        totalProduccion, totalVendidos, totalIngresos, totalGastos,
        totalMortalidad, totalHuevosCargados, totalIngresosEntregas,
        totalHuevosEntregados, gananciaNeta, tasaPosturaProm,
        promedioProduccion, promedioGanancia, eficienciaVenta,
        numeroRegistros: regs.length,
        graficoDatos,
        numeroAves,
        totalHuevosStock,
        totalCubetasStock,
      };
    }

    const metricasPrincipal = calcularMetricas(registros, cargas, entregas);

    // ── Período de comparación (opcional) ───────────────────
    let metricasComparacion = null;
    if (comparar) {
      const rangoComp = calcularRango(periodo, offset + 1);
      const regComp   = await prisma.registroDiario.findMany({
        where:   { granjaId, fecha: { gte: rangoComp.desde, lte: rangoComp.hasta } },
        include: { gastos: true },
        orderBy: { fecha: 'asc' },
      });
      const cargasComp   = await prisma.cargaConductor.findMany({ where: { granjaId, fecha: { gte: rangoComp.desde, lte: rangoComp.hasta } } });
      const entregasComp = await prisma.entregaConductor.findMany({ where: { granjaId, fecha: { gte: rangoComp.desde, lte: rangoComp.hasta } } });
      metricasComparacion = {
        label:    rangoComp.label,
        metricas: calcularMetricas(regComp, cargasComp, entregasComp),
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        periodo,
        offset,
        label:    rango.label,
        metricas: metricasPrincipal,
        comparacion: metricasComparacion,
        // Datos hoy (siempre, para las tarjetas de estado actual)
        ...(periodo !== 'hoy' && offset === 0
          ? { stockActual: { totalHuevosStock, totalCubetasStock, numeroAves } }
          : {}),
      },
    });
  } catch (error) {
    console.error('Error en dashboard:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}