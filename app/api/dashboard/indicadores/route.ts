import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { IndicadoresDiarios, IndicadoresSemanales } from '@/types';

export async function GET(request: Request) {
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
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No tienes una granja configurada',
      });
    }

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || 'hoy';

    if (tipo === 'hoy') {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      // Buscar por granjaId_fecha (el unique constraint actual)
      const registroHoy = await prisma.registroDiario.findUnique({
        where: {
          granjaId_fecha: {
            granjaId,
            fecha: hoy,
          },
        },
        include: {
          gastos: true,
        },
      });

      if (!registroHoy) {
        return NextResponse.json({
          success: true,
          data: null,
          message: 'No hay registro para hoy',
        });
      }

      const gastoTotal = registroHoy.gastos.reduce(
        (sum, gasto) => sum + Number(gasto.monto),
        0
      );

      const indicadores: IndicadoresDiarios = {
        fecha: registroHoy.fecha.toISOString().split('T')[0],
        huevosProducidos: registroHoy.huevosProducidos,
        huevosVendidos: registroHoy.huevosVendidos,
        ingresoTotal: Number(registroHoy.ingresoTotal),
        gastoTotal,
        gananciaNeta: Number(registroHoy.ingresoTotal) - gastoTotal,
      };

      return NextResponse.json({
        success: true,
        data: indicadores,
      });
    } else if (tipo === 'semanal') {
      const hoy = new Date();
      hoy.setHours(23, 59, 59, 999);

      const hace7Dias = new Date(hoy);
      hace7Dias.setDate(hace7Dias.getDate() - 6);
      hace7Dias.setHours(0, 0, 0, 0);

      const registros = await prisma.registroDiario.findMany({
        where: {
          granjaId,
          fecha: {
            gte: hace7Dias,
            lte: hoy,
          },
        },
        include: {
          gastos: true,
        },
        orderBy: {
          fecha: 'asc',
        },
      });

      const registrosProcesados: IndicadoresDiarios[] = registros.map(
        (registro) => {
          const gastoTotal = registro.gastos.reduce(
            (sum, gasto) => sum + Number(gasto.monto),
            0
          );

          return {
            fecha: registro.fecha.toISOString().split('T')[0],
            huevosProducidos: registro.huevosProducidos,
            huevosVendidos: registro.huevosVendidos,
            ingresoTotal: Number(registro.ingresoTotal),
            gastoTotal,
            gananciaNeta: Number(registro.ingresoTotal) - gastoTotal,
          };
        }
      );

      const totalIngresos = registrosProcesados.reduce(
        (sum, r) => sum + r.ingresoTotal,
        0
      );
      const totalGastos = registrosProcesados.reduce(
        (sum, r) => sum + r.gastoTotal,
        0
      );
      const totalProduccion = registrosProcesados.reduce(
        (sum, r) => sum + r.huevosProducidos,
        0
      );
      const totalGanancias = registrosProcesados.reduce(
        (sum, r) => sum + r.gananciaNeta,
        0
      );

      const diasConRegistro = registrosProcesados.length || 1;

      const indicadores: IndicadoresSemanales = {
        promedioProduccion: Math.round(totalProduccion / diasConRegistro),
        promedioGanancia: Math.round(totalGanancias / diasConRegistro),
        totalIngresos,
        totalGastos,
        registros: registrosProcesados,
      };

      return NextResponse.json({
        success: true,
        data: indicadores,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Tipo de indicador no válido' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error al obtener indicadores:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener indicadores' },
      { status: 500 }
    );
  }
}