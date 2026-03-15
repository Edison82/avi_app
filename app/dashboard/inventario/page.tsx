'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Package, Egg, History, ShieldCheck,
  Plus, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle,
  RefreshCw, X, AlertTriangle,
  ToggleLeft, ToggleRight,
} from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────
type CategoriaHuevo = 'JUMBO' | 'AAA' | 'AA' | 'A' | 'B' | 'C';
const TODAS_CATEGORIAS: CategoriaHuevo[] = ['JUMBO', 'AAA', 'AA', 'A', 'B', 'C'];

interface StockHuevo {
  categoriaHuevo:  CategoriaHuevo;
  cantidadHuevos:  number;
  cantidadCubetas: number;
  updatedAt:       string | null;
}

interface Insumo {
  id:          string;
  nombre:      string;
  descripcion: string | null;
  unidad:      string;
  stockActual: number;
  stockMinimo: number;
  activo:      boolean;
  updatedAt:   string;
}

type TipoMovimiento = 'INSUMO_ENTRADA' | 'INSUMO_SALIDA' | 'CARGA_CONDUCTOR';

interface MovimientoHistorial {
  id:          string;
  tipo:        TipoMovimiento;
  fecha:       string;
  descripcion: string;
  cantidad:    number;
  unidad:      string;
  usuario:     { id: string; nombre: string; rol: string };
  extra?: {
    insumoNombre?:       string;
    precioUnitario?:     number | null;
    observaciones?:      string | null;
    categoriaHuevo?:     string;
    cubetas?:            number;
    huevosEquivalentes?: number;
  };
}

interface OperarioPermiso {
  id:                string;
  nombre:            string;
  email:             string;
  activo:            boolean;
  permisoInventario: boolean;
}

type TabVista = 'huevos' | 'insumos' | 'historial' | 'permisos';

// ── Constantes ─────────────────────────────────────────────────
const CATEGORIA_INFO: Record<CategoriaHuevo, { color: string; bg: string; bar: string; desc: string }> = {
  JUMBO: { color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', bar: 'bg-violet-400', desc: 'Extra grandes' },
  AAA:   { color: 'text-amber-700',  bg: 'bg-amber-50  border-amber-200',  bar: 'bg-amber-400',  desc: '1ª calidad'   },
  AA:    { color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', bar: 'bg-yellow-400', desc: '2ª calidad'   },
  A:     { color: 'text-green-700',  bg: 'bg-green-50  border-green-200',  bar: 'bg-green-400',  desc: 'Estándar'     },
  B:     { color: 'text-blue-700',   bg: 'bg-blue-50   border-blue-200',   bar: 'bg-blue-400',   desc: 'Segunda'      },
  C:     { color: 'text-gray-700',   bg: 'bg-gray-50   border-gray-200',   bar: 'bg-gray-400',   desc: 'Comercial'    },
};

const ROL_LABEL: Record<string, string> = {
  ADMIN: 'Admin', OPERARIO: 'Operario', CONDUCTOR: 'Conductor',
};

const TIPO_BADGE: Record<TipoMovimiento, { label: string; icon: typeof ArrowUpCircle; color: string }> = {
  INSUMO_ENTRADA:  { label: 'Entrada insumo',  icon: ArrowUpCircle,   color: 'bg-green-100 text-green-700' },
  INSUMO_SALIDA:   { label: 'Salida insumo',   icon: ArrowDownCircle, color: 'bg-red-100   text-red-700'   },
  CARGA_CONDUCTOR: { label: 'Carga conductor', icon: ArrowDownCircle, color: 'bg-amber-100 text-amber-700' },
};

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

const formatDateTime = (s: string) =>
  new Date(s).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

// ── Normalizar stock de huevos ─────────────────────────────────
function normalizarStockHuevos(raw: unknown[]): StockHuevo[] {
  const acum: Record<string, { huevos: number; updatedAt: string | null }> = {};
  for (const item of raw) {
    const r   = item as Record<string, unknown>;
    const cat = String(r.categoriaHuevo ?? '');
    if (!cat) continue;
    const huevos = Number(r.cantidadHuevos) || 0;
    const ts     = (r.updatedAt as string) ?? null;
    if (acum[cat]) { acum[cat].huevos += huevos; acum[cat].updatedAt = ts ?? acum[cat].updatedAt; }
    else           { acum[cat] = { huevos, updatedAt: ts }; }
  }
  return TODAS_CATEGORIAS.map((cat) => {
    const huevos = acum[cat]?.huevos ?? 0;
    return { categoriaHuevo: cat, cantidadHuevos: huevos, cantidadCubetas: Math.floor(huevos / 30), updatedAt: acum[cat]?.updatedAt ?? null };
  });
}

function Spinner() {
  return (
    <div className="text-center py-16">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto" />
      <p className="mt-3 text-gray-400 text-sm">Cargando...</p>
    </div>
  );
}

function Alerta({ msg, tipo, onClose }: { msg: string; tipo: 'ok' | 'err'; onClose: () => void }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium border
      ${tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
      <span>{msg}</span>
      <button onClick={onClose}><X size={15} /></button>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────
export default function InventarioPage() {
  const { data: session } = useSession();
  const isAdmin    = session?.user?.rol === 'ADMIN';
  const isOperario = session?.user?.rol === 'OPERARIO';

  const [tab,    setTab]    = useState<TabVista>('huevos');
  const [alerta, setAlerta] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null);

  const [huevos,    setHuevos]    = useState<StockHuevo[]>([]);
  const [insumos,   setInsumos]   = useState<Insumo[]>([]);
  const [historial, setHistorial] = useState<MovimientoHistorial[]>([]);
  const [operarios, setOperarios] = useState<OperarioPermiso[]>([]);
  const [paginaHist,   setPaginaHist]   = useState(1);
  const [totalPagHist, setTotalPagHist] = useState(1);

  const [loadingHuevos,    setLoadingHuevos]    = useState(false);
  const [loadingInsumos,   setLoadingInsumos]   = useState(false);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [loadingPermisos,  setLoadingPermisos]  = useState(false);
  const [deletingInsumoId, setDeletingInsumoId] = useState<string | null>(null);

  const [modalInsumo,     setModalInsumo]     = useState(false);
  const [modalMovimiento, setModalMovimiento] = useState<(Insumo & { _tipo?: string }) | null>(null);
  const [editandoInsumo,  setEditandoInsumo]  = useState<Insumo | null>(null);

  // ── Fetches ──────────────────────────────────────────────────
  const fetchHuevos = useCallback(async () => {
    setLoadingHuevos(true);
    try {
      const res  = await fetch('/api/inventario');
      const json = await res.json();
      if (json.success) setHuevos(normalizarStockHuevos(json.data ?? []));
    } finally { setLoadingHuevos(false); }
  }, []);

  const fetchInsumos = useCallback(async () => {
    setLoadingInsumos(true);
    try {
      const res  = await fetch('/api/inventario/insumos');
      const json = await res.json();
      if (json.success) setInsumos(json.data ?? []);
    } finally { setLoadingInsumos(false); }
  }, []);

  const fetchHistorial = useCallback(async (pag = 1) => {
    setLoadingHistorial(true);
    try {
      const res  = await fetch(`/api/inventario/historial?pagina=${pag}&limite=15`);
      const json = await res.json();
      if (json.success) {
        setHistorial(json.data ?? []);
        setTotalPagHist(json.pagination?.totalPaginas ?? 1);
      }
    } finally { setLoadingHistorial(false); }
  }, []);

  const fetchPermisos = useCallback(async () => {
    setLoadingPermisos(true);
    try {
      const res  = await fetch('/api/inventario/permisos');
      const json = await res.json();
      if (json.success) setOperarios(json.data ?? []);
    } finally { setLoadingPermisos(false); }
  }, []);

  useEffect(() => {
    if (tab === 'huevos')    fetchHuevos();
    if (tab === 'insumos')   fetchInsumos();
    if (tab === 'historial') fetchHistorial(paginaHist);
    if (tab === 'permisos')  fetchPermisos();
  }, [tab, paginaHist, fetchHuevos, fetchInsumos, fetchHistorial, fetchPermisos]);

  const mostrarAlerta = (msg: string, tipo: 'ok' | 'err') => {
    setAlerta({ msg, tipo });
    setTimeout(() => setAlerta(null), 4000);
  };

  const togglePermiso = async (usuarioId: string, actual: boolean) => {
    const res  = await fetch('/api/inventario/permisos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ usuarioId, activo: !actual }),
    });
    const json = await res.json();
    mostrarAlerta(json.message ?? json.error, json.success ? 'ok' : 'err');
    if (json.success) fetchPermisos();
  };

  // ── Eliminar insumo ──────────────────────────────────────────
  const handleDeleteInsumo = async (insumo: Insumo) => {
    if (!confirm(`¿Desactivar "${insumo.nombre}"?\nEl historial de movimientos se conservará.`)) return;
    setDeletingInsumoId(insumo.id);
    try {
      const res  = await fetch(`/api/inventario/insumos/${insumo.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        mostrarAlerta(json.message ?? 'Insumo desactivado', 'ok');
        fetchInsumos();
      } else {
        mostrarAlerta(json.error ?? 'Error al desactivar', 'err');
      }
    } finally { setDeletingInsumoId(null); }
  };

  // ── Totales ──────────────────────────────────────────────────
  const totalHuevos  = huevos.reduce((s, h) => s + h.cantidadHuevos, 0);
  const totalCubetas = Math.floor(totalHuevos / 30);
  const maxCubetas   = Math.max(...huevos.map((h) => h.cantidadCubetas), 1);

  const TABS: { id: TabVista; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { id: 'huevos',    label: 'Huevos',    icon: Egg                           },
    { id: 'insumos',   label: 'Insumos',   icon: Package                       },
    { id: 'historial', label: 'Historial', icon: History,    adminOnly: true   },
    { id: 'permisos',  label: 'Permisos',  icon: ShieldCheck, adminOnly: true  },
  ];

  const refrescar = () => {
    if (tab === 'huevos')    fetchHuevos();
    if (tab === 'insumos')   fetchInsumos();
    if (tab === 'historial') fetchHistorial(paginaHist);
    if (tab === 'permisos')  fetchPermisos();
  };

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500 mt-1 text-sm">Stock de huevos e insumos de la granja</p>
        </div>
        <button onClick={refrescar}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl
                     text-sm text-gray-600 hover:bg-gray-50 transition-colors shadow-sm">
          <RefreshCw size={15} /> Actualizar
        </button>
      </div>

      {alerta && <Alerta msg={alerta.msg} tipo={alerta.tipo} onClose={() => setAlerta(null)} />}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit flex-wrap">
        {TABS.filter((t) => !t.adminOnly || isAdmin).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ════ HUEVOS ════ */}
      {tab === 'huevos' && (
        <div className="space-y-4">
          {loadingHuevos ? <Spinner /> : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Total en stock</p>
                  <p className="text-4xl font-black text-gray-900">{totalCubetas.toLocaleString()}</p>
                  <p className="text-sm text-gray-500 mt-0.5">cubetas ({totalHuevos.toLocaleString()} huevos)</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-500 mb-1">Categorías con stock</p>
                  <p className="text-4xl font-black text-amber-700">{huevos.filter((h) => h.cantidadHuevos > 0).length}</p>
                  <p className="text-sm text-amber-500 mt-0.5">de 6 categorías</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {huevos.map((item) => {
                  const info  = CATEGORIA_INFO[item.categoriaHuevo];
                  const pct   = maxCubetas > 0 ? (item.cantidadCubetas / maxCubetas) * 100 : 0;
                  const vacio = item.cantidadHuevos === 0;
                  return (
                    <div key={item.categoriaHuevo} className={`rounded-2xl border p-4 ${info.bg} ${vacio ? 'opacity-60' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-lg font-black ${info.color}`}>{item.categoriaHuevo}</span>
                        <span className="text-[10px] text-gray-400">{info.desc}</span>
                      </div>
                      {vacio && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-500 rounded-full">AGOTADO</span>}
                      <div className="w-full bg-white/60 rounded-full h-1.5 my-2">
                        <div className={`h-1.5 rounded-full transition-all ${info.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className={`text-2xl font-black ${info.color}`}>{item.cantidadCubetas.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">cubetas</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-700">{item.cantidadHuevos.toLocaleString()}</p>
                          <p className="text-xs text-gray-400">huevos</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-white/50">
                        {item.updatedAt ? formatDate(item.updatedAt) : 'Sin movimientos'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ════ INSUMOS ════ */}
      {tab === 'insumos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {isAdmin ? 'Gestiona el catálogo y registra entradas y salidas' : 'Registra entradas y salidas de insumos'}
            </p>
            {isAdmin && (
              <button onClick={() => { setEditandoInsumo(null); setModalInsumo(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors">
                <Plus size={15} /> Nuevo Insumo
              </button>
            )}
          </div>

          {loadingInsumos ? <Spinner /> : insumos.filter((i) => i.activo).length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border">
              <Package size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No hay insumos registrados</p>
              {isAdmin && (
                <button onClick={() => { setEditandoInsumo(null); setModalInsumo(true); }}
                  className="mt-3 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold">
                  Crear primer insumo
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insumos.filter((i) => i.activo).map((insumo) => {
                const bajoStock = Number(insumo.stockActual) <= Number(insumo.stockMinimo) && Number(insumo.stockMinimo) > 0;
                return (
                  <div key={insumo.id}
                    className={`bg-white rounded-2xl border p-4 shadow-sm ${bajoStock ? 'border-red-200' : 'border-gray-100'}`}>

                    {/* Header tarjeta */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900 text-sm">{insumo.nombre}</h3>
                          {bajoStock && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">
                              <AlertTriangle size={9} /> BAJO
                            </span>
                          )}
                        </div>
                        {insumo.descripcion && <p className="text-xs text-gray-400 mt-0.5 truncate">{insumo.descripcion}</p>}
                      </div>

                      {/* Botones admin: editar + eliminar */}
                      {isAdmin && (
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          <button
                            onClick={() => { setEditandoInsumo(insumo); setModalInsumo(true); }}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Editar insumo"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteInsumo(insumo)}
                            disabled={deletingInsumoId === insumo.id}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                            title="Desactivar insumo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Stock */}
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-3xl font-black text-gray-900">{Number(insumo.stockActual).toLocaleString()}</p>
                        <p className="text-xs text-gray-400">{insumo.unidad}s en stock</p>
                      </div>
                      {Number(insumo.stockMinimo) > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Mínimo</p>
                          <p className="text-sm font-semibold text-gray-600">{Number(insumo.stockMinimo)} {insumo.unidad}s</p>
                        </div>
                      )}
                    </div>

                    {/* Botones entrada / salida */}
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <button onClick={() => setModalMovimiento({ ...insumo, _tipo: 'ENTRADA' })}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-50
                                   hover:bg-green-100 text-green-700 rounded-xl text-xs font-semibold transition-colors">
                        <ArrowUpCircle size={14} /> Entrada
                      </button>
                      <button onClick={() => setModalMovimiento({ ...insumo, _tipo: 'SALIDA' })}
                        disabled={Number(insumo.stockActual) <= 0}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-50
                                   hover:bg-red-100 text-red-700 rounded-xl text-xs font-semibold
                                   transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <ArrowDownCircle size={14} /> Salida
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isOperario && (
            <p className="text-xs text-gray-400 text-center">
              ¿No puedes registrar movimientos? Solicita permiso al administrador.
            </p>
          )}
        </div>
      )}

      {/* ════ HISTORIAL ════ */}
      {tab === 'historial' && isAdmin && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-800 text-sm">
              Historial de Movimientos — Insumos y Cargas del Conductor
            </h2>
          </div>
          {loadingHistorial ? <Spinner /> : historial.length === 0 ? (
            <div className="text-center py-16">
              <History size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">Sin movimientos registrados</p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left   text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left   text-xs font-medium text-gray-500 uppercase">Descripción</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-right  text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-4 py-3 text-left   text-xs font-medium text-gray-500 uppercase">Usuario</th>
                      <th className="px-4 py-3 text-left   text-xs font-medium text-gray-500 uppercase">Obs.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {historial.map((m) => {
                      const badge     = TIPO_BADGE[m.tipo];
                      const BadgeIcon = badge.icon;
                      return (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDateTime(m.fecha)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{m.descripcion}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${badge.color}`}>
                              <BadgeIcon size={10} /> {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-800">
                            {Number(m.cantidad).toLocaleString()} {m.unidad}s
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <p>{m.usuario?.nombre ?? '—'}</p>
                            <p className="text-xs text-gray-400">{ROL_LABEL[m.usuario?.rol] ?? m.usuario?.rol ?? '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                            {m.extra?.observaciones ? String(m.extra.observaciones) : <span className="text-gray-300 italic">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile */}
              <div className="md:hidden divide-y">
                {historial.map((m) => {
                  const badge     = TIPO_BADGE[m.tipo];
                  const BadgeIcon = badge.icon;
                  return (
                    <div key={m.id} className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-gray-900 truncate max-w-[60%]">{m.descripcion}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${badge.color}`}>
                          <BadgeIcon size={10} /> {badge.label}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{m.usuario?.nombre ?? '—'} · {ROL_LABEL[m.usuario?.rol] ?? '—'}</span>
                        <span className="font-semibold">{Number(m.cantidad).toLocaleString()} {m.unidad}s</span>
                      </div>
                      <p className="text-xs text-gray-400">{formatDateTime(m.fecha)}</p>
                      {m.extra?.observaciones && <p className="text-xs text-gray-400 italic">{String(m.extra.observaciones)}</p>}
                    </div>
                  );
                })}
              </div>
              {totalPagHist > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                  <button onClick={() => setPaginaHist((p) => Math.max(1, p - 1))} disabled={paginaHist === 1}
                    className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-100">Anterior</button>
                  <span className="text-xs text-gray-500">Página {paginaHist} de {totalPagHist}</span>
                  <button onClick={() => setPaginaHist((p) => Math.min(totalPagHist, p + 1))} disabled={paginaHist === totalPagHist}
                    className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-100">Siguiente</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════ PERMISOS ════ */}
      {tab === 'permisos' && isAdmin && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Habilita o deshabilita el acceso de cada operario al inventario de insumos.</p>
          {loadingPermisos ? <Spinner /> : operarios.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border">
              <ShieldCheck size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No hay operarios asignados a la granja</p>
            </div>
          ) : (
            operarios.map((op) => (
              <div key={op.id} className="flex items-center justify-between bg-white border rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-blue-700">{(op.nombre ?? '?')[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{op.nombre}</p>
                    <p className="text-xs text-gray-400">{op.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-medium text-gray-600">
                      {op.permisoInventario ? 'Puede añadir insumos' : 'Sin acceso al inventario'}
                    </p>
                    <p className={`text-xs ${op.permisoInventario ? 'text-green-600' : 'text-gray-400'}`}>
                      {op.permisoInventario ? '✓ Habilitado' : '✗ Deshabilitado'}
                    </p>
                  </div>
                  <button onClick={() => togglePermiso(op.id, op.permisoInventario)}
                    className={`transition-colors ${op.permisoInventario ? 'text-green-500 hover:text-green-700' : 'text-gray-300 hover:text-gray-500'}`}
                    title={op.permisoInventario ? 'Revocar permiso' : 'Otorgar permiso'}>
                    {op.permisoInventario ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ════ MODALES ════ */}
      {modalInsumo && isAdmin && (
        <ModalInsumo
          insumo={editandoInsumo}
          onClose={() => { setModalInsumo(false); setEditandoInsumo(null); }}
          onGuardado={(msg) => { mostrarAlerta(msg, 'ok'); fetchInsumos(); setModalInsumo(false); setEditandoInsumo(null); }}
          onError={(msg) => mostrarAlerta(msg, 'err')}
        />
      )}

      {modalMovimiento && (
        <ModalMovimiento
          insumo={modalMovimiento}
          tipoInicial={modalMovimiento._tipo as 'ENTRADA' | 'SALIDA' | undefined}
          onClose={() => setModalMovimiento(null)}
          onGuardado={(msg) => { mostrarAlerta(msg, 'ok'); fetchInsumos(); fetchHistorial(1); setModalMovimiento(null); }}
          onError={(msg) => mostrarAlerta(msg, 'err')}
        />
      )}
    </div>
  );
}

// ── Modal Nuevo / Editar Insumo ────────────────────────────────
function ModalInsumo({ insumo, onClose, onGuardado, onError }: {
  insumo: Insumo | null; onClose: () => void;
  onGuardado: (msg: string) => void; onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    nombre:      insumo?.nombre      ?? '',
    descripcion: insumo?.descripcion ?? '',
    unidad:      insumo?.unidad      ?? 'unidad',
    stockMinimo: Number(insumo?.stockMinimo) || 0,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url    = insumo ? `/api/inventario/insumos/${insumo.id}` : '/api/inventario/insumos';
      const method = insumo ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json   = await res.json();
      if (json.success) onGuardado(insumo ? 'Insumo actualizado' : 'Insumo creado exitosamente');
      else onError(json.error ?? 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-bold text-gray-900">{insumo ? 'Editar Insumo' : 'Nuevo Insumo'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required
              placeholder="Ej: Concentrado ponedoras"
              className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea value={form.descripcion ?? ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={2}
              className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad *</label>
              <input value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })} required
                placeholder="bulto, kg, litro..."
                className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo</label>
              <input type="number" min="0" step="0.01" value={form.stockMinimo}
                onChange={(e) => setForm({ ...form, stockMinimo: Number(e.target.value) })}
                className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
              {saving ? 'Guardando...' : (insumo ? 'Actualizar' : 'Crear')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal Movimiento ───────────────────────────────────────────
function ModalMovimiento({ insumo, tipoInicial, onClose, onGuardado, onError }: {
  insumo: Insumo; tipoInicial?: 'ENTRADA' | 'SALIDA';
  onClose: () => void; onGuardado: (msg: string) => void; onError: (msg: string) => void;
}) {
  const [tipo,     setTipo]     = useState<'ENTRADA' | 'SALIDA'>(tipoInicial ?? 'ENTRADA');
  const [cantidad, setCantidad] = useState('');
  const [precio,   setPrecio]   = useState('');
  const [obs,      setObs]      = useState('');
  const [saving,   setSaving]   = useState(false);
  const esEntrada = tipo === 'ENTRADA';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cantidad || Number(cantidad) <= 0) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/inventario/insumos/${insumo.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ tipo, cantidad: Number(cantidad), precioUnitario: precio ? Number(precio) : undefined, observaciones: obs || undefined }),
      });
      const json = await res.json();
      if (json.success) onGuardado(json.message ?? `${esEntrada ? 'Entrada' : 'Salida'} registrada`);
      else onError(json.error ?? 'Error al registrar');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="font-bold text-gray-900">Registrar Movimiento</h3>
            <p className="text-xs text-gray-500">{insumo.nombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            {(['ENTRADA', 'SALIDA'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTipo(t)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all
                  ${tipo === t ? (t === 'ENTRADA' ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'text-gray-500 hover:text-gray-700'}`}>
                {t === 'ENTRADA' ? <ArrowUpCircle size={15} /> : <ArrowDownCircle size={15} />}
                {t === 'ENTRADA' ? 'Entrada' : 'Salida'}
              </button>
            ))}
          </div>
          <div className={`rounded-xl p-3 text-sm flex justify-between border ${esEntrada ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
            <span className="text-gray-600">Stock actual:</span>
            <span className="font-bold">{Number(insumo.stockActual).toLocaleString()} {insumo.unidad}s</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad ({insumo.unidad}s) *</label>
            <input type="number" min="0.01" step="0.01" required value={cantidad} onChange={(e) => setCantidad(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          {esEntrada && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio unitario (opcional)</label>
              <input type="number" min="0" step="1" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="COP"
                className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Proveedor, lote, motivo de salida..."
              className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving}
              className={`flex-1 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-60 transition-colors ${esEntrada ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
              {saving ? 'Registrando...' : `Confirmar ${esEntrada ? 'Entrada' : 'Salida'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}