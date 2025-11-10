'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Egg, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { IndicadoresDiarios, IndicadoresSemanales } from '@/types';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const router = useRouter();
  const [indicadoresHoy, setIndicadoresHoy] = useState<IndicadoresDiarios | null>(null);
  const [indicadoresSemanales, setIndicadoresSemanales] = useState<IndicadoresSemanales | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIndicadores();
  }, []);

  const fetchIndicadores = async () => {
    try {
      const [hoyRes, semanalRes] = await Promise.all([
        fetch('/api/dashboard/indicadores?tipo=hoy'),
        fetch('/api/dashboard/indicadores?tipo=semanal')
      ]);

      const hoyData = await hoyRes.json();
      const semanalData = await semanalRes.json();

      if (hoyData.success) {
        setIndicadoresHoy(hoyData.data);
      }

      if (semanalData.success) {
        setIndicadoresSemanales(semanalData.data);
      }
    } catch (err) {
      setError('Error al cargar indicadores');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Resumen de tu operación avícola</p>
        </div>
        <Button onClick={() => router.push('/dashboard/registros/nuevo')}>
          + Registrar Día
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert type="error" message={error} onClose={() => setError(null)} />
      )}

      {/* Indicadores de Hoy */}
      {!indicadoresHoy ? (
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">No hay registro para el día de hoy</p>
            <Button onClick={() => router.push('/dashboard/registros/nuevo')}>
              Crear Registro
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-gray-800">Indicadores de Hoy</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Huevos Producidos"
              value={indicadoresHoy.huevosProducidos}
              icon={<Egg size={32} />}
            />
            <StatCard
              title="Huevos Vendidos"
              value={indicadoresHoy.huevosVendidos}
              icon={<Egg size={32} />}
            />
            <StatCard
              title="Ingresos"
              value={formatCurrency(indicadoresHoy.ingresoTotal)}
              icon={<DollarSign size={32} />}
            />
            <StatCard
              title="Ganancia Neta"
              value={formatCurrency(indicadoresHoy.gananciaNeta)}
              icon={indicadoresHoy.gananciaNeta >= 0 ? <TrendingUp size={32} /> : <TrendingDown size={32} />}
              className={indicadoresHoy.gananciaNeta >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}
            />
          </div>
        </>
      )}

      {/* Indicadores Semanales */}
      {indicadoresSemanales && indicadoresSemanales.registros.length > 0 && (
        <>
          <h2 className="text-xl font-semibold text-gray-800 mt-8">Últimos 7 Días</h2>
          
          {/* Resumen Semanal */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard
              title="Promedio Producción"
              value={`${indicadoresSemanales.promedioProduccion} huevos/día`}
            />
            <StatCard
              title="Promedio Ganancia"
              value={formatCurrency(indicadoresSemanales.promedioGanancia)}
            />
            <StatCard
              title="Total Ingresos"
              value={formatCurrency(indicadoresSemanales.totalIngresos)}
            />
            <StatCard
              title="Total Gastos"
              value={formatCurrency(indicadoresSemanales.totalGastos)}
            />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Producción */}
            <Card title="Producción Diaria">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={indicadoresSemanales.registros}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="huevosProducidos" 
                    stroke="#22c55e" 
                    name="Producidos"
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="huevosVendidos" 
                    stroke="#3b82f6" 
                    name="Vendidos"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Gráfico de Ingresos vs Gastos */}
            <Card title="Ingresos vs Gastos">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={indicadoresSemanales.registros}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="ingresoTotal" fill="#22c55e" name="Ingresos" />
                  <Bar dataKey="gastoTotal" fill="#ef4444" name="Gastos" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}