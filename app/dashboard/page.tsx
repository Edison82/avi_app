'use client';
 
import { useState } from 'react';
import { Card, StatCard } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import {
  Egg, DollarSign, TrendingUp, TrendingDown,
  Bird, Skull, Activity, BarChart2,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
 
// ── Tipos extendidos con las nuevas métricas ───────────────────
interface IndicadoresHoy {
  huevosProducidos:  number;
  huevosVendidos:    number;
  ingresoTotal:      number;
  gananciaNeta:      number;
  totalGastos:       number;
  numeroAves:        number;
  tasaPostura:       number;   // %
  huevosPorGallina:  number;
  mortalidad:        number;
  tasaMortalidad:    number;   // %
}
 
interface RegistroSemanal {
  fecha:            string;
  huevosProducidos: number;
  huevosVendidos:   number;
  ingresoTotal:     number;
  gastoTotal:       number;
  ganancia:         number;
  tasaPostura:      number;
  mortalidad:       number;
}
 
interface IndicadoresSemanales {
  registros:          RegistroSemanal[];
  totalIngresos:      number;
  totalGastos:        number;
  totalMortalidad:    number;
  promedioProduccion: number;
  promedioGanancia:   number;
  promedioTasaPostura:number;
  numeroAves:         number;
}
 
// ── Helper de formato moneda ───────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(n);
}
 
// ── Componente de gauge visual para tasa de postura ────────────
function TasaPosturaGauge({ valor }: { valor: number }) {
  // Color: <60% rojo, 60-80% ámbar, >80% verde
  const color =
    valor >= 80 ? '#22c55e' :
    valor >= 60 ? '#f59e0b' : '#ef4444';
 
  const label =
    valor >= 80 ? 'Excelente' :
    valor >= 60 ? 'Aceptable' : 'Baja';
 
  // Arco SVG simple
  const radio    = 40;
  const circunf  = 2 * Math.PI * radio;
  const relleno  = (Math.min(valor, 100) / 100) * circunf * 0.75; // 270° de arco
 
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-20 flex items-center justify-center">
        <svg viewBox="0 0 100 70" className="w-full h-full">
          {/* Fondo del arco */}
          <path
            d="M 10 65 A 40 40 0 1 1 90 65"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Relleno proporcional */}
          <path
            d="M 10 65 A 40 40 0 1 1 90 65"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${relleno} ${circunf}`}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div className="absolute bottom-0 text-center">
          <p className="text-lg font-bold text-gray-900">{valor}%</p>
        </div>
      </div>
      <span className="text-xs font-medium mt-1" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
 
// ── Dashboard principal ────────────────────────────────────────
export default function DashboardPage() {
  const [indicadoresHoy,       setIndicadoresHoy]       = useState<IndicadoresHoy | null>(null);
  const [indicadoresSemanales, setIndicadoresSemanales] = useState<IndicadoresSemanales | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
 
  // ── Carga con inicialización lazy (sin useEffect directo) ──
  useState(() => {
    (async () => {
      try {
        const [hoyRes, semanalRes] = await Promise.all([
          fetch('/api/dashboard/indicadores?tipo=hoy'),
          fetch('/api/dashboard/indicadores?tipo=semanal'),
        ]);
        const hoyData     = await hoyRes.json();
        const semanalData = await semanalRes.json();
 
        if (hoyData.success)     setIndicadoresHoy(hoyData.data);
        if (semanalData.success) setIndicadoresSemanales(semanalData.data);
      } catch (err) {
        setError('Error al cargar indicadores');
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  });
 
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }
 
  return (
    <div className="space-y-8">
 
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Resumen de tu operación avícola</p>
      </div>
 
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
 
      {/* ── Indicadores de Hoy ── */}
      {!indicadoresHoy ? (
        <Card>
          <div className="text-center py-10">
            <Egg size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No hay registro para el día de hoy</p>
            <p className="text-sm text-gray-400 mt-1">Crea un nuevo registro para ver los indicadores</p>
          </div>
        </Card>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-gray-700">📋 Indicadores de Hoy</h2>
 
          {/* Fila 1: métricas financieras */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Huevos Producidos"
              value={indicadoresHoy.huevosProducidos}
              icon={<Egg size={28} />}
            />
            <StatCard
              title="Huevos Vendidos"
              value={indicadoresHoy.huevosVendidos}
              icon={<Egg size={28} />}
            />
            <StatCard
              title="Ingresos"
              value={fmt(indicadoresHoy.ingresoTotal)}
              icon={<DollarSign size={28} />}
            />
            <StatCard
              title="Ganancia Neta"
              value={fmt(indicadoresHoy.gananciaNeta)}
              icon={
                indicadoresHoy.gananciaNeta >= 0
                  ? <TrendingUp size={28} />
                  : <TrendingDown size={28} />
              }
              className={
                indicadoresHoy.gananciaNeta >= 0
                  ? 'border-l-4 border-green-500'
                  : 'border-l-4 border-red-500'
              }
            />
          </div>
 
          {/* Fila 2: métricas avícolas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 
            {/* Tasa de postura con gauge */}
            <Card>
              <div className="flex flex-col items-center py-2">
                <div className="flex items-center gap-2 mb-3 self-start">
                  <Activity size={16} className="text-amber-500" />
                  <p className="text-sm font-medium text-gray-600">Tasa de Postura</p>
                </div>
                <TasaPosturaGauge valor={indicadoresHoy.tasaPostura} />
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Referencia óptima: ≥ 80%
                </p>
              </div>
            </Card>
 
            {/* Huevos por gallina */}
            <Card>
              <div className="py-2">
                <div className="flex items-center gap-2 mb-3">
                  <Bird size={16} className="text-blue-500" />
                  <p className="text-sm font-medium text-gray-600">Huevos / Gallina</p>
                </div>
                <p className="text-3xl font-bold text-blue-600">
                  {indicadoresHoy.huevosPorGallina.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400 mt-1">unidades por ave hoy</p>
                <p className="text-xs text-gray-400">
                  Base: {indicadoresHoy.numeroAves.toLocaleString()} aves activas
                </p>
              </div>
            </Card>
 
            {/* Mortalidad */}
            <Card>
              <div className="py-2">
                <div className="flex items-center gap-2 mb-3">
                  <Skull size={16} className="text-red-400" />
                  <p className="text-sm font-medium text-gray-600">Mortalidad Hoy</p>
                </div>
                <p className={`text-3xl font-bold ${
                  indicadoresHoy.mortalidad > 0 ? 'text-red-500' : 'text-gray-400'
                }`}>
                  {indicadoresHoy.mortalidad}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  aves ({indicadoresHoy.tasaMortalidad}% del lote)
                </p>
                {indicadoresHoy.mortalidad >= 10 && (
                  <p className="text-xs text-red-500 mt-1 font-medium">
                    🚨 Alta mortalidad — revisar galpón
                  </p>
                )}
              </div>
            </Card>
 
            {/* Aves activas */}
            <Card>
              <div className="py-2">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 size={16} className="text-green-500" />
                  <p className="text-sm font-medium text-gray-600">Aves Activas</p>
                </div>
                <p className="text-3xl font-bold text-green-600">
                  {indicadoresHoy.numeroAves.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-1">total en tu granja</p>
              </div>
            </Card>
          </div>
        </>
      )}
 
      {/* ── Indicadores Semanales ── */}
      {indicadoresSemanales && indicadoresSemanales.registros.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-gray-700 mt-4">📅 Últimos 7 Días</h2>
 
          {/* Resumen semanal */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Prom. Producción"  value={`${indicadoresSemanales.promedioProduccion} huevos/día`} />
            <StatCard title="Prom. Ganancia"    value={fmt(indicadoresSemanales.promedioGanancia)} />
            <StatCard title="Total Ingresos"    value={fmt(indicadoresSemanales.totalIngresos)} />
            <StatCard title="Total Gastos"      value={fmt(indicadoresSemanales.totalGastos)} />
          </div>
 
          {/* Resumen métricas avícolas semanales */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-1">
                Prom. Tasa Postura
              </p>
              <p className="text-2xl font-bold text-amber-700">
                {indicadoresSemanales.promedioTasaPostura}%
              </p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-1">
                Mortalidad Semana
              </p>
              <p className="text-2xl font-bold text-red-600">
                {indicadoresSemanales.totalMortalidad} aves
              </p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-1">
                Aves Activas Ahora
              </p>
              <p className="text-2xl font-bold text-green-700">
                {indicadoresSemanales.numeroAves.toLocaleString()}
              </p>
            </div>
          </div>
 
          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 
            {/* Producción */}
            <Card title="Producción Diaria">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={indicadoresSemanales.registros}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="huevosProducidos" stroke="#22c55e" name="Producidos" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="huevosVendidos"   stroke="#3b82f6" name="Vendidos"   strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
 
            {/* Ingresos vs Gastos */}
            <Card title="Ingresos vs Gastos">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={indicadoresSemanales.registros}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="ingresoTotal" fill="#22c55e" name="Ingresos" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gastoTotal"   fill="#ef4444" name="Gastos"   radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
 
            {/* Tasa de Postura */}
            <Card title="Tasa de Postura (%)">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={indicadoresSemanales.registros}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Legend />
                  {/* Línea de referencia óptima */}
                  <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="4 4" label={{ value: 'Óptimo 80%', fontSize: 10, fill: '#22c55e' }} />
                  <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Mín 60%',    fontSize: 10, fill: '#f59e0b' }} />
                  <Line type="monotone" dataKey="tasaPostura" stroke="#f59e0b" name="Tasa Postura" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
 
            {/* Mortalidad */}
            <Card title="Mortalidad Diaria (aves)">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={indicadoresSemanales.registros}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(v: number) => `${v} aves`} />
                  <Legend />
                  <Bar dataKey="mortalidad" fill="#f87171" name="Mortalidad" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}