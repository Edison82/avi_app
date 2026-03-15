'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card} from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import {
  Egg, DollarSign, TrendingUp, TrendingDown, Bird, Skull,
  Activity, BarChart2, Package, ChevronLeft, ChevronRight,
  GitCompare, RefreshCw, Boxes,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ── Tipos ──────────────────────────────────────────────────────
interface Metricas {
  totalProduccion:       number;
  totalVendidos:         number;
  totalIngresos:         number;
  totalGastos:           number;
  totalMortalidad:       number;
  totalHuevosCargados:   number;
  totalIngresosEntregas: number;
  totalHuevosEntregados: number;
  gananciaNeta:          number;
  tasaPosturaProm:       number;
  promedioProduccion:    number;
  promedioGanancia:      number;
  eficienciaVenta:       number;
  numeroRegistros:       number;
  numeroAves:            number;
  totalHuevosStock:      number;
  totalCubetasStock:     number;
  graficoDatos: {
    fecha:            string;
    huevosProducidos: number;
    huevosVendidos:   number;
    ingresoTotal:     number;
    gastoTotal:       number;
    ganancia:         number;
    tasaPostura:      number;
    mortalidad:       number;
  }[];
}

interface DashboardData {
  periodo:     string;
  offset:      number;
  label:       string;
  metricas:    Metricas;
  comparacion: { label: string; metricas: Metricas } | null;
}

type Periodo = 'hoy' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'anio';

// ── Constantes ─────────────────────────────────────────────────
const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'hoy',       label: 'Hoy'        },
  { id: 'semana',    label: 'Semana'     },
  { id: 'mes',       label: 'Mes'        },
  { id: 'trimestre', label: 'Trimestre'  },
  { id: 'semestre',  label: 'Semestre'   },
  { id: 'anio',       label: 'Año'        },
];

// ── Helpers ─────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

const fmtK = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(0)}K`
  : String(n);

function delta(actual: number, anterior: number) {
  if (anterior === 0) return null;
  const pct = ((actual - anterior) / anterior) * 100;
  return { pct: parseFloat(pct.toFixed(1)), positivo: pct >= 0 };
}

// ── Gauge tasa de postura ──────────────────────────────────────
function TasaPosturaGauge({ valor }: { valor: number }) {
  const color = valor >= 80 ? '#22c55e' : valor >= 60 ? '#f59e0b' : '#ef4444';
  const label = valor >= 80 ? 'Excelente' : valor >= 60 ? 'Aceptable' : 'Baja';
  const radio   = 40;
  const circunf = 2 * Math.PI * radio;
  const relleno = (Math.min(valor, 100) / 100) * circunf * 0.75;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-20 flex items-center justify-center">
        <svg viewBox="0 0 100 70" className="w-full h-full">
          <path d="M 10 65 A 40 40 0 1 1 90 65" fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round" />
          <path d="M 10 65 A 40 40 0 1 1 90 65" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${relleno} ${circunf}`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        </svg>
        <div className="absolute bottom-0 text-center">
          <p className="text-lg font-bold text-gray-900">{valor}%</p>
        </div>
      </div>
      <span className="text-xs font-medium mt-1" style={{ color }}>{label}</span>
    </div>
  );
}

// ── Badge de delta ─────────────────────────────────────────────
function DeltaBadge({ actual, anterior }: { actual: number; anterior: number }) {
  const d = delta(actual, anterior);
  if (!d) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full
      ${d.positivo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
      {d.positivo ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {Math.abs(d.pct)}%
    </span>
  );
}

// ── Tooltip personalizado ──────────────────────────────────────
function TooltipCOP({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-800">
            {typeof p.value === 'number' && p.value > 1000 ? fmt(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────
export default function DashboardPage() {
  const [periodo,   setPeriodo]   = useState<Periodo>('mes');
  const [offset,    setOffset]    = useState(0);
  const [comparar,  setComparar]  = useState(false);
  const [data,      setData]      = useState<DashboardData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/dashboard/indicadores?periodo=${periodo}&offset=${offset}&comparar=${comparar}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error ?? 'Error al cargar');
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [periodo, offset, comparar]);

  useEffect(() => { cargar(); }, [cargar]);

  // Cuando cambia el período, resetear el offset
  const cambiarPeriodo = (p: Periodo) => { setPeriodo(p); setOffset(0); };

  const m   = data?.metricas;
  const mc  = data?.comparacion?.metricas;
  const hasGraficos = (m?.graficoDatos?.length ?? 0) > 0;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {data ? data.label : 'Cargando...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={cargar} className="p-2 rounded-xl border bg-white hover:bg-gray-50 transition-colors shadow-sm">
            <RefreshCw size={16} className={loading ? 'animate-spin text-amber-500' : 'text-gray-500'} />
          </button>
          <button
            onClick={() => setComparar((c) => !c)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all shadow-sm
              ${comparar ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <GitCompare size={15} />
            Comparar
          </button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* ── Selector de período ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {PERIODOS.map(({ id, label }) => (
            <button key={id} onClick={() => cambiarPeriodo(id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${periodo === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Navegación hacia atrás/adelante */}
        <div className="flex items-center gap-1 border rounded-xl bg-white shadow-sm overflow-hidden">
          <button onClick={() => setOffset((o) => o + 1)}
            className="p-2 hover:bg-gray-50 transition-colors border-r">
            <ChevronLeft size={16} className="text-gray-500" />
          </button>
          <span className="px-3 text-xs text-gray-500 font-medium whitespace-nowrap">
            {offset === 0 ? 'Actual' : `−${offset}`}
          </span>
          <button onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0}
            className="p-2 hover:bg-gray-50 transition-colors border-l disabled:opacity-30">
            <ChevronRight size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto" />
            <p className="mt-4 text-gray-500 text-sm">Cargando dashboard...</p>
          </div>
        </div>
      ) : !m ? (
        <Card>
          <div className="text-center py-16">
            <Egg size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Sin datos para este período</p>
            <p className="text-sm text-gray-400 mt-1">Intenta con otro período o navega hacia períodos con registros</p>
          </div>
        </Card>
      ) : (
        <>
          {/* ── Tarjetas de estado actual (siempre visibles) ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

            {/* Huevos en stock */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Boxes size={16} className="text-amber-500" />
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Stock Huevos</p>
              </div>
              <p className="text-3xl font-black text-amber-700">{m.totalCubetasStock.toLocaleString()}</p>
              <p className="text-xs text-amber-500 mt-0.5">cubetas · {m.totalHuevosStock.toLocaleString()} huevos</p>
            </div>

            {/* Aves activas */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Bird size={16} className="text-green-500" />
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Aves Activas</p>
              </div>
              <p className="text-3xl font-black text-green-700">{m.numeroAves.toLocaleString()}</p>
              <p className="text-xs text-green-500 mt-0.5">en producción ahora</p>
            </div>

            {/* Ganancia neta del período */}
            <div className={`rounded-2xl p-4 shadow-sm border
              ${m.gananciaNeta >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {m.gananciaNeta >= 0 ? <TrendingUp size={16} className="text-blue-500" /> : <TrendingDown size={16} className="text-red-500" />}
                <p className={`text-xs font-semibold uppercase tracking-wider ${m.gananciaNeta >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  Ganancia
                </p>
              </div>
              <p className={`text-2xl font-black ${m.gananciaNeta >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                {fmtK(Math.abs(m.gananciaNeta))}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <p className={`text-xs ${m.gananciaNeta >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                  {data?.label}
                </p>
                {mc && <DeltaBadge actual={m.gananciaNeta} anterior={mc.gananciaNeta} />}
              </div>
            </div>

            {/* Tasa de postura */}
            <div className="bg-white border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Activity size={16} className="text-amber-500" />
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Tasa Postura</p>
              </div>
              <TasaPosturaGauge valor={m.tasaPosturaProm} />
              {mc && <DeltaBadge actual={m.tasaPosturaProm} anterior={mc.tasaPosturaProm} />}
            </div>
          </div>

          {/* ── KPIs principales ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Producción', value: m.totalProduccion.toLocaleString(), sub: 'huevos', icon: <Egg size={18} className="text-yellow-500" />, delta: mc ? { a: m.totalProduccion, b: mc.totalProduccion } : null },
              { label: 'Ingresos',   value: fmtK(m.totalIngresos),   sub: 'COP',    icon: <DollarSign size={18} className="text-green-500" />, delta: mc ? { a: m.totalIngresos, b: mc.totalIngresos } : null },
              { label: 'Gastos',     value: fmtK(m.totalGastos),     sub: 'COP',    icon: <TrendingDown size={18} className="text-red-400" />, delta: mc ? { a: m.totalGastos, b: mc.totalGastos } : null },
              { label: 'Eficiencia Venta', value: `${m.eficienciaVenta}%`, sub: 'vendido/producido', icon: <BarChart2 size={18} className="text-purple-500" />, delta: mc ? { a: m.eficienciaVenta, b: mc.eficienciaVenta } : null },
            ].map(({ label, value, sub, icon, delta: d }) => (
              <div key={label} className="bg-white rounded-2xl border p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
                  {icon}
                </div>
                <p className="text-2xl font-black text-gray-900">{value}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-gray-400">{sub}</p>
                  {d && <DeltaBadge actual={d.a} anterior={d.b} />}
                </div>
              </div>
            ))}
          </div>

          {/* ── Fila 3: métricas avícolas ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Huevos Cargados',    value: m.totalHuevosCargados.toLocaleString(),   sub: `${Math.floor(m.totalHuevosCargados / 30)} cubetas`, icon: <Package size={18} className="text-orange-400" />, c: 'text-orange-700' },
              { label: 'Huevos Entregados',  value: m.totalHuevosEntregados.toLocaleString(), sub: `${m.totalIngresosEntregas > 0 ? fmtK(m.totalIngresosEntregas) : '—'} ingresos`, icon: <Egg size={18} className="text-amber-500" />, c: 'text-amber-700' },
              { label: 'Mortalidad',         value: m.totalMortalidad.toString(),              sub: 'aves en el período', icon: <Skull size={18} className="text-red-400" />, c: m.totalMortalidad > 0 ? 'text-red-600' : 'text-gray-400' },
              { label: 'Prom. Producción',   value: `${m.promedioProduccion}`,                sub: 'huevos/día promedio', icon: <Activity size={18} className="text-blue-500" />, c: 'text-blue-700' },
            ].map(({ label, value, sub, icon, c }) => (
              <div key={label} className="bg-white rounded-2xl border p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
                  {icon}
                </div>
                <p className={`text-2xl font-black ${c}`}>{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* ── Comparación lado a lado ── */}
          {comparar && mc && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <GitCompare size={16} className="text-amber-600" />
                <h3 className="font-bold text-gray-800 text-sm">
                  Comparando: <span className="text-amber-700">{data?.label}</span>
                  {' '}vs <span className="text-gray-500">{data?.comparacion?.label}</span>
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Producción',   a: m.totalProduccion,   b: mc.totalProduccion,   fmt_: (v: number) => v.toLocaleString() },
                  { label: 'Ingresos',     a: m.totalIngresos,     b: mc.totalIngresos,     fmt_: fmt },
                  { label: 'Ganancia',     a: m.gananciaNeta,      b: mc.gananciaNeta,      fmt_: fmt },
                  { label: 'Tasa Postura', a: m.tasaPosturaProm,   b: mc.tasaPosturaProm,   fmt_: (v: number) => `${v}%` },
                ].map(({ label, a, b, fmt_ }) => {
                  const d = delta(a, b);
                  return (
                    <div key={label} className="bg-white rounded-xl p-3 shadow-sm">
                      <p className="text-xs text-gray-500 font-medium mb-2">{label}</p>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-amber-600 font-semibold">Actual</span>
                          <span className="text-sm font-bold text-gray-900">{fmt_(a)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-gray-400 font-semibold">Anterior</span>
                          <span className="text-sm font-semibold text-gray-500">{fmt_(b)}</span>
                        </div>
                        {d && (
                          <div className={`text-center text-xs font-bold py-0.5 rounded ${d.positivo ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                            {d.positivo ? '▲' : '▼'} {Math.abs(d.pct)}%
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Gráficos ── */}
          {hasGraficos && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Producción */}
              <div className="bg-white rounded-2xl border p-4 shadow-sm">
                <h3 className="font-semibold text-gray-800 text-sm mb-4">Producción de Huevos</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={m.graficoDatos}>
                    <defs>
                      <linearGradient id="gradProd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}   />
                      </linearGradient>
                      <linearGradient id="gradVend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip content={<TooltipCOP />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="huevosProducidos" stroke="#22c55e" fill="url(#gradProd)" name="Producidos" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="huevosVendidos"   stroke="#3b82f6" fill="url(#gradVend)" name="Vendidos"   strokeWidth={2} dot={false} />
                    {/* Línea de comparación si aplica */}
                    {mc?.graficoDatos && <Line type="monotone" dataKey="huevosProducidos" data={mc.graficoDatos} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1} dot={false} name="Prod. anterior" />}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Ingresos vs Gastos */}
              <div className="bg-white rounded-2xl border p-4 shadow-sm">
                <h3 className="font-semibold text-gray-800 text-sm mb-4">Ingresos vs Gastos (COP)</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={m.graficoDatos} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtK} />
                    <Tooltip content={<TooltipCOP />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="ingresoTotal" fill="#22c55e" name="Ingresos" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="gastoTotal"   fill="#f87171" name="Gastos"   radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Ganancia neta */}
              <div className="bg-white rounded-2xl border p-4 shadow-sm">
                <h3 className="font-semibold text-gray-800 text-sm mb-4">Ganancia Neta (COP)</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={m.graficoDatos}>
                    <defs>
                      <linearGradient id="gradGan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtK} />
                    <Tooltip content={<TooltipCOP />} />
                    <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="ganancia" stroke="#6366f1" fill="url(#gradGan)" name="Ganancia" strokeWidth={2} dot={false} />
                    {mc?.graficoDatos && <Line type="monotone" dataKey="ganancia" data={mc.graficoDatos} stroke="#6366f1" strokeDasharray="4 4" strokeWidth={1} dot={false} name="Gan. anterior" />}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Tasa de postura */}
              <div className="bg-white rounded-2xl border p-4 shadow-sm">
                <h3 className="font-semibold text-gray-800 text-sm mb-4">Tasa de Postura (%)</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={m.graficoDatos}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="4 4"
                      label={{ value: '80% óptimo', fontSize: 9, fill: '#22c55e', position: 'insideTopRight' }} />
                    <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="4 4"
                      label={{ value: '60% mín', fontSize: 9, fill: '#f59e0b', position: 'insideTopRight' }} />
                    <Line type="monotone" dataKey="tasaPostura" stroke="#f59e0b" name="Tasa Postura" strokeWidth={2} dot={{ r: 3 }} />
                    {mc?.graficoDatos && <Line type="monotone" dataKey="tasaPostura" data={mc.graficoDatos} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} dot={false} name="TP anterior" />}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Mortalidad */}
              <div className="bg-white rounded-2xl border p-4 shadow-sm lg:col-span-2">
                <h3 className="font-semibold text-gray-800 text-sm mb-4">Mortalidad Diaria (aves)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={m.graficoDatos}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => `${v} aves`} />
                    <Bar dataKey="mortalidad" fill="#f87171" name="Aves muertas" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>
          )}

          {/* Sin registros en el período */}
          {!hasGraficos && (
            <div className="bg-white rounded-2xl border p-10 text-center">
              <BarChart2 size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No hay registros diarios en este período</p>
              <p className="text-xs text-gray-400 mt-1">Las tarjetas de resumen muestran el estado actual del inventario y las aves</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}