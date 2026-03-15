'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { Eye, Trash2, Search, ClipboardList, Truck, Package } from 'lucide-react';
import { RegistroDiarioConRelaciones } from '@/types';

// ── Tipos ──────────────────────────────────────────────────────
type UsuarioResumen = {
  id:     string;
  nombre: string;
  email:  string;
  rol:    'ADMIN' | 'OPERARIO' | 'CONDUCTOR';
};

type CategoriaHuevo = 'JUMBO' | 'AAA' | 'AA' | 'A' | 'B' | 'C';

type RegistroConUsuario = RegistroDiarioConRelaciones & {
  usuario?:       UsuarioResumen | null;
  categoriaHuevo?: CategoriaHuevo;
};

type DetalleCategoria = { categoria: CategoriaHuevo; cantidad: number };

type EntregaResponse = {
  id:                    string;
  fecha:                 string;
  huevosEntregados:      number;
  precioVentaUnitario:   number;
  ingresoTotal:          number;
  clienteNombre?:        string | null;
  conductor?:            { id: string; nombre: string; email: string } | null;
  detalleCategoriasJson?: DetalleCategoria[] | unknown;
};

function parseDetallesEntrega(raw: unknown): DetalleCategoria[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (d): d is DetalleCategoria =>
      d && typeof d === 'object' && 'categoria' in d && 'cantidad' in d
  );
}

type CargaResponse = {
  id:                 string;
  fecha:              string;
  categoriaHuevo:     CategoriaHuevo;
  cubetas:            number;
  huevosEquivalentes: number;
  observaciones?:     string | null;
  conductor?:         { id: string; nombre: string; email: string } | null;
};

type Vista = 'registros' | 'entregas' | 'cargas';

// ── Helpers ────────────────────────────────────────────────────
const formatCurrency = (v: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(v);

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

const formatDateShort = (s: string) =>
  new Date(s).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

const formatTime = (s: string) =>
  new Date(s).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

// ── Badges ─────────────────────────────────────────────────────
const ROL_BADGE: Record<UsuarioResumen['rol'], { label: string; color: string }> = {
  ADMIN:     { label: 'Admin',     color: 'bg-purple-100 text-purple-700' },
  OPERARIO:  { label: 'Operario',  color: 'bg-blue-100   text-blue-700'   },
  CONDUCTOR: { label: 'Conductor', color: 'bg-orange-100 text-orange-700' },
};

const CATEGORIA_BADGE: Record<CategoriaHuevo, string> = {
  JUMBO: 'bg-violet-100 text-violet-700',
  AAA:   'bg-amber-100  text-amber-700',
  AA:    'bg-yellow-100 text-yellow-700',
  A:     'bg-green-100  text-green-700',
  B:     'bg-blue-100   text-blue-700',
  C:     'bg-gray-100   text-gray-600',
};

function CategoriaPill({ cat }: { cat?: CategoriaHuevo }) {
  if (!cat) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${CATEGORIA_BADGE[cat]}`}>
      {cat}
    </span>
  );
}

function RolPill({ rol }: { rol: UsuarioResumen['rol'] }) {
  const { label, color } = ROL_BADGE[rol];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}

function Spinner() {
  return (
    <div className="text-center py-12">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto" />
      <p className="mt-3 text-gray-400 text-sm">Cargando...</p>
    </div>
  );
}

function Paginacion({
  pagina, total, onChange,
}: {
  pagina: number; total: number; onChange: (p: number) => void;
}) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t">
      <Button
        variant="outline"
        onClick={() => onChange(Math.max(1, pagina - 1))}
        disabled={pagina === 1}
        className="text-gray-700"
      >
        Anterior
      </Button>
      <span className="text-sm text-gray-500">Página {pagina} de {total}</span>
      <Button
        variant="outline"
        onClick={() => onChange(Math.min(total, pagina + 1))}
        disabled={pagina === total}
        className="text-gray-700"
      >
        Siguiente
      </Button>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────
export default function RegistrosPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.rol === 'ADMIN';

  const [vista,   setVista]   = useState<Vista>('registros');
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Registros ──
  const [registros,   setRegistros]   = useState<RegistroConUsuario[]>([]);
  const [loadingReg,  setLoadingReg]  = useState(true);
  const [paginaReg,   setPaginaReg]   = useState(1);
  const [totalPagReg, setTotalPagReg] = useState(1);
  const [fechaDesde,  setFechaDesde]  = useState('');
  const [fechaHasta,  setFechaHasta]  = useState('');

  // ── Entregas ──
  const [entregas,    setEntregas]    = useState<EntregaResponse[]>([]);
  const [loadingEnt,  setLoadingEnt]  = useState(false);
  const [paginaEnt,   setPaginaEnt]   = useState(1);
  const [totalPagEnt, setTotalPagEnt] = useState(1);

  // ── Cargas ──
  const [cargas,      setCargas]      = useState<CargaResponse[]>([]);
  const [loadingCar,  setLoadingCar]  = useState(false);
  const [paginaCar,   setPaginaCar]   = useState(1);
  const [totalPagCar, setTotalPagCar] = useState(1);

  // ── Fetch registros ──────────────────────────────────────────
  useEffect(() => {
    if (vista !== 'registros') return;
    const run = async () => {
      setLoadingReg(true);
      try {
        const p = new URLSearchParams({ pagina: paginaReg.toString(), limite: '10' });
        if (fechaDesde) p.append('fechaDesde', fechaDesde);
        if (fechaHasta) p.append('fechaHasta', fechaHasta);
        const res  = await fetch(`/api/registros?${p}`);
        const data = await res.json();
        if (data.success) {
          setRegistros(data.data);
          setTotalPagReg(data.pagination.totalPaginas);
        } else {
          setError(data.error);
        }
      } catch {
        setError('Error al cargar registros');
      } finally {
        setLoadingReg(false);
      }
    };
    run();
  }, [vista, paginaReg, fechaDesde, fechaHasta]);

  // ── Fetch entregas ───────────────────────────────────────────
  useEffect(() => {
    if (vista !== 'entregas') return;
    const run = async () => {
      setLoadingEnt(true);
      try {
        const res  = await fetch(`/api/entregas?pagina=${paginaEnt}&limite=10`);
        const data = await res.json();
        if (data.success) {
          setEntregas(data.data);
          setTotalPagEnt(data.pagination.totalPaginas);
        } else {
          setError(data.error);
        }
      } catch {
        setError('Error al cargar entregas');
      } finally {
        setLoadingEnt(false);
      }
    };
    run();
  }, [vista, paginaEnt]);

  // ── Fetch cargas ─────────────────────────────────────────────
  useEffect(() => {
    if (vista !== 'cargas') return;
    const run = async () => {
      setLoadingCar(true);
      try {
        const res  = await fetch(`/api/cargas?pagina=${paginaCar}&limite=10`);
        const data = await res.json();
        if (data.success) {
          setCargas(data.data);
          setTotalPagCar(data.pagination.totalPaginas);
        } else {
          setError(data.error);
        }
      } catch {
        setError('Error al cargar cargas');
      } finally {
        setLoadingCar(false);
      }
    };
    run();
  }, [vista, paginaCar]);

  // ── Eliminar registro ────────────────────────────────────────
  const handleDelete = useCallback(async (id: string, fecha: string) => {
    if (!confirm(`¿Eliminar registro del ${fecha}?\nLos huevos producidos serán revertidos del inventario.`)) return;
    try {
      const res  = await fetch(`/api/registros/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSuccess('Registro eliminado e inventario revertido');
        setRegistros((prev) => prev.filter((r) => r.id !== id));
        if (registros.length === 1 && paginaReg > 1) setPaginaReg((p) => p - 1);
        setTimeout(() => setSuccess(null), 3500);
      } else {
        setError(data.error ?? 'No se pudo eliminar');
      }
    } catch {
      setError('Error al eliminar registro');
    }
  }, [registros.length, paginaReg]);

  const calcGastos = (r: RegistroConUsuario) =>
    r.gastos.reduce((s, g) => s + Number(g.monto), 0);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Historial</h1>
          <p className="text-gray-500 mt-1 text-sm">Registros, entregas y cargas de la granja</p>
        </div>
        {vista === 'registros' && (
          <Button onClick={() => router.push('/dashboard/registros/nuevo')}>
            + Nuevo Registro
          </Button>
        )}
      </div>

      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
      {error   && <Alert type="error"   message={error}   onClose={() => setError(null)}   />}

      {/* Toggle de vistas (solo ADMIN) */}
      {isAdmin && (
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
          {([
            { id: 'registros', icon: ClipboardList, label: 'Registros del Operario' },
            { id: 'entregas',  icon: Truck,         label: 'Entregas del Conductor' },
            { id: 'cargas',    icon: Package,       label: 'Registros de Cargas'    },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setVista(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
                ${vista === id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════
          REGISTROS DEL OPERARIO
      ═══════════════════════════════════ */}
      {vista === 'registros' && (
        <>
          <Card title="Filtros de Búsqueda">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Fecha Desde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
              <Input
                label="Fecha Hasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
              <div className="flex items-end gap-2">
                <Button onClick={() => setPaginaReg(1)} className="flex-1">
                  <Search size={15} className="mr-1.5" />
                  Buscar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setFechaDesde(''); setFechaHasta(''); setPaginaReg(1); }}
                >
                  Limpiar
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            {loadingReg ? (
              <Spinner />
            ) : registros.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No hay registros para mostrar</p>
                <Button onClick={() => router.push('/dashboard/registros/nuevo')}>
                  Crear Primer Registro
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left   text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        {isAdmin && (
                          <>
                            <th className="px-4 py-3 text-left   text-xs font-medium text-gray-500 uppercase">Usuario</th>
                            <th className="px-4 py-3 text-left   text-xs font-medium text-gray-500 uppercase">Rol</th>
                          </>
                        )}
                        <th className="px-4 py-3 text-center  text-xs font-medium text-gray-500 uppercase">Categoría</th>
                        <th className="px-4 py-3 text-right   text-xs font-medium text-gray-500 uppercase">Producidos</th>
                        <th className="px-4 py-3 text-right   text-xs font-medium text-gray-500 uppercase">Vendidos</th>
                        <th className="px-4 py-3 text-right   text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                        <th className="px-4 py-3 text-right   text-xs font-medium text-gray-500 uppercase">Gastos</th>
                        <th className="px-4 py-3 text-right   text-xs font-medium text-gray-500 uppercase">Ganancia</th>
                        <th className="px-4 py-3 text-center  text-xs font-medium text-gray-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {registros.map((r) => {
                        const gastos  = calcGastos(r);
                        const ganancia = Number(r.ingresoTotal) - gastos;
                        return (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                              {formatDate(r.fecha.toString())}
                            </td>
                            {isAdmin && (
                              <>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {r.usuario?.nombre ?? '—'}
                                </td>
                                <td className="px-4 py-3">
                                  {r.usuario?.rol
                                    ? <RolPill rol={r.usuario.rol} />
                                    : <span className="text-gray-300 text-xs">—</span>
                                  }
                                </td>
                              </>
                            )}
                            <td className="px-4 py-3 text-center">
                              <CategoriaPill cat={r.categoriaHuevo} />
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-800">
                              {r.huevosProducidos}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-800">
                              {r.huevosVendidos}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                              {formatCurrency(Number(r.ingresoTotal))}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                              {formatCurrency(gastos)}
                            </td>
                            <td className={`px-4 py-3 text-sm text-right font-bold
                              ${ganancia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(ganancia)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center gap-1">
                                <button
                                  onClick={() => router.push(`/dashboard/registros/${r.id}`)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                  title="Ver detalle"
                                >
                                  <Eye size={15} />
                                </button>
                                <button
                                  onClick={() => handleDelete(r.id, formatDate(r.fecha.toString()))}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                  title="Eliminar"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="md:hidden space-y-3">
                  {registros.map((r) => {
                    const gastos   = calcGastos(r);
                    const ganancia = Number(r.ingresoTotal) - gastos;
                    return (
                      <div key={r.id} className="border rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <p className="font-semibold text-sm text-gray-900">
                              {formatDate(r.fecha.toString())}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <CategoriaPill cat={r.categoriaHuevo} />
                              {isAdmin && r.usuario && <RolPill rol={r.usuario.rol} />}
                            </div>
                            {isAdmin && r.usuario && (
                              <p className="text-xs text-gray-500">{r.usuario.nombre}</p>
                            )}
                            <p className="text-xs text-gray-500">
                              {r.huevosProducidos} producidos · {r.huevosVendidos} vendidos
                            </p>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <button
                              onClick={() => router.push(`/dashboard/registros/${r.id}`)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id, formatDate(r.fecha.toString()))}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-gray-500">Ingresos</p>
                            <p className="font-semibold text-green-600">
                              {formatCurrency(Number(r.ingresoTotal))}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Gastos</p>
                            <p className="font-semibold text-red-600">{formatCurrency(gastos)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Ganancia</p>
                            <p className={`font-bold ${ganancia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(ganancia)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Paginacion pagina={paginaReg} total={totalPagReg} onChange={setPaginaReg} />
              </>
            )}
          </Card>
        </>
      )}

      {/* ═══════════════════════════════════
          ENTREGAS DEL CONDUCTOR
      ═══════════════════════════════════ */}
      {vista === 'entregas' && isAdmin && (
        <Card>
          {loadingEnt ? (
            <Spinner />
          ) : entregas.length === 0 ? (
            <div className="text-center py-12">
              <Truck size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No hay entregas registradas</p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left  text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left  text-xs font-medium text-gray-500 uppercase">Conductor</th>
                      <th className="px-4 py-3 text-left  text-xs font-medium text-gray-500 uppercase">Cliente</th>
                      <th className="px-4 py-3 text-left  text-xs font-medium text-gray-500 uppercase">Categorías</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total huevos</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Precio</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {entregas.map((e) => {
                      const detalles = parseDetallesEntrega(e.detalleCategoriasJson);
                      return (
                      <tr key={e.id} className="hover:bg-gray-50 align-top">
                        <td className="px-4 py-3 text-sm">
                          <p className="text-gray-900">{formatDateShort(e.fecha)}</p>
                          <p className="text-xs text-gray-400">{formatTime(e.fecha)}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {e.conductor?.nombre ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {e.clienteNombre || (
                            <span className="text-gray-400 italic">Sin nombre</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {detalles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {detalles.map((d) => (
                                <span key={d.categoria}
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CATEGORIA_BADGE[d.categoria]}`}>
                                  {d.categoria} ×{d.cantidad}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">{e.huevosEntregados} huevos</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          {e.huevosEntregados}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          {formatCurrency(e.precioVentaUnitario)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                          {formatCurrency(e.ingresoTotal)}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3">
                {entregas.map((e) => {
                  const detalles = parseDetallesEntrega(e.detalleCategoriasJson);
                  return (
                  <div key={e.id} className="border rounded-xl p-4 space-y-2">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">
                          {formatDateShort(e.fecha)}
                        </p>
                        <p className="text-xs text-gray-400">{e.conductor?.nombre ?? '—'}</p>
                      </div>
                      <p className="font-bold text-green-600 text-sm">
                        {formatCurrency(e.ingresoTotal)}
                      </p>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{e.clienteNombre || 'Sin nombre'}</span>
                      <span>{e.huevosEntregados} huevos</span>
                    </div>
                    {detalles.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {detalles.map((d) => (
                          <span key={d.categoria}
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CATEGORIA_BADGE[d.categoria]}`}>
                            {d.categoria} ×{d.cantidad}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )})}
              </div>
              <Paginacion pagina={paginaEnt} total={totalPagEnt} onChange={setPaginaEnt} />
            </>
          )}
        </Card>
      )}

      {/* ═══════════════════════════════════
          REGISTROS DE CARGAS
      ═══════════════════════════════════ */}
      {vista === 'cargas' && isAdmin && (
        <Card>
          {loadingCar ? (
            <Spinner />
          ) : cargas.length === 0 ? (
            <div className="text-center py-12">
              <Package size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No hay cargas registradas</p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left   text-xs font-medium text-gray-500 uppercase">Fecha y Hora</th>
                      <th className="px-4 py-3 text-left   text-xs font-medium text-gray-500 uppercase">Conductor</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Categoría</th>
                      <th className="px-4 py-3 text-right  text-xs font-medium text-gray-500 uppercase">Cubetas</th>
                      <th className="px-4 py-3 text-right  text-xs font-medium text-gray-500 uppercase">Huevos</th>
                      <th className="px-4 py-3 text-left   text-xs font-medium text-gray-500 uppercase">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cargas.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          <p className="text-gray-900">{formatDateShort(c.fecha)}</p>
                          <p className="text-xs text-gray-400">{formatTime(c.fecha)}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {c.conductor?.nombre ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <CategoriaPill cat={c.categoriaHuevo} />
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                          {c.cubetas}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          {c.huevosEquivalentes.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                          {c.observaciones || (
                            <span className="text-gray-300 italic">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-3">
                {cargas.map((c) => (
                  <div key={c.id} className="border rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">
                          {formatDateShort(c.fecha)}
                        </p>
                        <p className="text-xs text-gray-400">{c.conductor?.nombre ?? '—'}</p>
                      </div>
                      <CategoriaPill cat={c.categoriaHuevo} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{c.cubetas} cubetas</span>
                      <span>{c.huevosEquivalentes} huevos</span>
                    </div>
                    {c.observaciones && (
                      <p className="text-xs text-gray-400">{c.observaciones}</p>
                    )}
                  </div>
                ))}
              </div>

              <Paginacion pagina={paginaCar} total={totalPagCar} onChange={setPaginaCar} />
            </>
          )}
        </Card>
      )}

    </div>
  );
}