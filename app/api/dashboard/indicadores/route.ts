import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGranjaId } from '@/lib/getGranjaId';
 
export async function GET(request: Request) {
  try {
    const { granjaId } = await getGranjaId();
    if (!granjaId) {
      return NextResponse.json(
        { success: false, error: 'No tienes una granja configurada' },
        { status: 400 }
      );
    }
 
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo'); // 'hoy' | 'semanal'
 
    // Traemos la granja para tener numeroAves actualizado
    const granja = await prisma.granja.findUnique({
      where: { id: granjaId },
      select: { numeroAves: true },
    });
 
    const numeroAves = granja?.numeroAves ?? 1; // evita división por 0
 
    // ── INDICADORES DE HOY ──────────────────────────────────────
    if (tipo === 'hoy') {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
 
      const registro = await prisma.registroDiario.findFirst({
        where: {
          granjaId,
          fecha: { gte: hoy },
        },
        include: {
          gastos: true,
        },
      });
 
      if (!registro) {
        return NextResponse.json({ success: true, data: null });
      }
 
      const totalGastos = registro.gastos.reduce(
        (sum, g) => sum + Number(g.monto),
        0
      );
      const ingresoTotal = Number(registro.ingresoTotal);
      const gananciaNeta = ingresoTotal - totalGastos;
 
      // Métricas avícolas
      // Tasa de postura = (huevos producidos / aves activas) × 100
      const tasaPostura = parseFloat(
        ((registro.huevosProducidos / numeroAves) * 100).toFixed(2)
      );
 
      // Huevos por gallina por día
      const huevosPorGallina = parseFloat(
        (registro.huevosProducidos / numeroAves).toFixed(3)
      );
 
      // Mortalidad del día y tasa de mortalidad
      const mortalidad = registro.mortalidad ?? 0;
      const tasaMortalidad = parseFloat(
        ((mortalidad / numeroAves) * 100).toFixed(3)
      );
 
      return NextResponse.json({
        success: true,
        data: {
          // Producción
          huevosProducidos:  registro.huevosProducidos,
          huevosVendidos:    registro.huevosVendidos,
          ingresoTotal,
          gananciaNeta,
          totalGastos,
          // Métricas avícolas
          numeroAves,
          tasaPostura,        // %
          huevosPorGallina,   // unidades/gallina/día
          mortalidad,         // aves muertas hoy
          tasaMortalidad,     // %
        },
      });
    }
 
    // ── INDICADORES SEMANALES ───────────────────────────────────
    if (tipo === 'semanal') {
      const hace7dias = new Date();
      hace7dias.setDate(hace7dias.getDate() - 6);
      hace7dias.setHours(0, 0, 0, 0);
 
      const registros = await prisma.registroDiario.findMany({
        where: {
          granjaId,
          fecha: { gte: hace7dias },
        },
        include: { gastos: true },
        orderBy: { fecha: 'asc' },
      });
 
      if (registros.length === 0) {
        return NextResponse.json({ success: true, data: { registros: [] } });
      }
 
      // Serializar para los gráficos
      const registrosSerializados = registros.map((r) => {
        const gastoTotal = r.gastos.reduce((s, g) => s + Number(g.monto), 0);
        const ganancia   = Number(r.ingresoTotal) - gastoTotal;
        const tPostura   = parseFloat(((r.huevosProducidos / numeroAves) * 100).toFixed(2));
        const mort       = r.mortalidad ?? 0;
 
        return {
          fecha:            new Date(r.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
          huevosProducidos: r.huevosProducidos,
          huevosVendidos:   r.huevosVendidos,
          ingresoTotal:     Number(r.ingresoTotal),
          gastoTotal,
          ganancia,
          tasaPostura:      tPostura,
          mortalidad:       mort,
        };
      });
 
      // Totales y promedios
      const totalIngresos       = registros.reduce((s, r) => s + Number(r.ingresoTotal), 0);
      const totalGastos         = registrosSerializados.reduce((s, r) => s + r.gastoTotal, 0);
      const totalProduccion     = registros.reduce((s, r) => s + r.huevosProducidos, 0);
      const totalMortalidad     = registros.reduce((s, r) => s + (r.mortalidad ?? 0), 0);
      const promedioProduccion  = Math.round(totalProduccion / registros.length);
      const promedioGanancia    = (totalIngresos - totalGastos) / registros.length;
      const promedioTasaPostura = parseFloat(
        (registrosSerializados.reduce((s, r) => s + r.tasaPostura, 0) / registros.length).toFixed(2)
      );
 
      return NextResponse.json({
        success: true,
        data: {
          registros: registrosSerializados,
          totalIngresos,
          totalGastos,
          totalMortalidad,
          promedioProduccion,
          promedioGanancia,
          promedioTasaPostura,
          numeroAves,
        },
      });
    }
 
    return NextResponse.json(
      { success: false, error: 'Parámetro tipo inválido. Usa: hoy | semanal' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error en indicadores dashboard:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}