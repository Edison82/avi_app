'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { Eye, Trash2, Search, ClipboardList, Truck } from 'lucide-react';
import { RegistroDiarioConRelaciones } from '@/types';

// ── Tipos ──────────────────────────────────────────────────────
type UsuarioResumen = {
  id:     string;
  nombre: string;
  email:  string;
  rol:    'ADMIN' | 'OPERARIO' | 'CONDUCTOR';
};

type RegistroConUsuario = RegistroDiarioConRelaciones & {
  usuario?: UsuarioResumen | null;
};

type EntregaResponse = {
  id:                  string;
  fecha:               string;
  huevosEntregados:    number;
  precioVentaUnitario: number;
  ingresoTotal:        number;
  clienteNombre?:      string | null;
  observaciones?:      string | null;
  conductor?:          { id: string; nombre: string; email: string } | null;
};

type Vista = 'registros' | 'entregas';

// ── Helpers ────────────────────────────────────────────────────
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(value);

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

const formatTime = (dateString: string) =>
  new Date(dateString).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit',
  });

// ── Componente principal ───────────────────────────────────────
export default function RegistrosPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.rol === 'ADMIN';

  // Vista activa: registros o entregas (solo admin puede alternar)
  const [vista, setVista] = useState<Vista>('registros');

  // ── Estado registros ──
  const [registros, setRegistros]       = useState<RegistroConUsuario[]>([]);
  const [loadingReg, setLoadingReg]     = useState(true);
  const [paginaReg, setPaginaReg]       = useState(1);
  const [totalPagReg, setTotalPagReg]   = useState(1);
  const [fechaDesde, setFechaDesde]     = useState('');
  const [fechaHasta, setFechaHasta]     = useState('');

  // ── Estado entregas ──
  const [entregas, setEntregas]         = useState<EntregaResponse[]>([]);
  const [loadingEnt, setLoadingEnt]     = useState(false);
  const [paginaEnt, setPaginaEnt]       = useState(1);
  const [totalPagEnt, setTotalPagEnt]   = useState(1);

  // ── Alertas ──
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Fetch registros ───────────────────────────────────────────
  useEffect(() => {
    if (vista !== 'registros') return;
    const fetchRegistros = async () => {
      setLoadingReg(true);
      try {
        const params = new URLSearchParams({
          pagina: paginaReg.toString(),
          limite: '10',
        });
        if (fechaDesde) params.append('fechaDesde', fechaDesde);
        if (fechaHasta) params.append('fechaHasta', fechaHasta);

        const res  = await fetch(`/api/registros?${params}`);
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
    fetchRegistros();
  }, [vista, paginaReg, fechaDesde, fechaHasta]);

  // ── Fetch entregas ────────────────────────────────────────────
  useEffect(() => {
    if (vista !== 'entregas') return;
    const fetchEntregas = async () => {
      setLoadingEnt(true);
      try {
        const params = new URLSearchParams({
          pagina: paginaEnt.toString(),
          limite: '10',
        });
        const res  = await fetch(`/api/entregas?${params}`);
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
    fetchEntregas();
  }, [vista, paginaEnt]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleBuscar = () => setPaginaReg(1);

  const handleLimpiar = () => {
    setFechaDesde('');
    setFechaHasta('');
    setPaginaReg(1);
  };

  const handleDelete = async (id: string, fecha: string) => {
    if (!confirm(`¿Estás seguro de eliminar el registro del ${fecha}?`)) return;
    try {
      const res  = await fetch(`/api/registros/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        setSuccess('Registro eliminado exitosamente');
        setRegistros((prev) => prev.filter((r) => r.id !== id));
        if (registros.length === 1 && paginaReg > 1) setPaginaReg((p) => p - 1);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error ?? 'No se pudo eliminar');
      }
    } catch {
      setError('Error al eliminar registro');
    }
  };

  // Badge de rol
  const getRolBadge = (rol: UsuarioResumen['rol']) => {
    const map: Record<UsuarioResumen['rol'], { label: string; color: string }> = {
      ADMIN:     { label: 'Admin',     color: 'bg-purple-100 text-purple-700' },
      OPERARIO:  { label: 'Operario',  color: 'bg-blue-100 text-blue-700'    },
      CONDUCTOR: { label: 'Conductor', color: 'bg-orange-100 text-orange-700'},
    };
    const { label, color } = map[rol];
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };

  const calcularTotalGastos = (r: RegistroConUsuario) =>
    r.gastos.reduce((s, g) => s + Number(g.monto), 0);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Historial</h1>
          <p className="text-gray-500 mt-1">Consulta y gestiona registros y entregas</p>
        </div>
        {vista === 'registros' && (
          <Button onClick={() => router.push('/dashboard/registros/nuevo')}>
            + Nuevo Registro
          </Button>
        )}
      </div>

      {/* Alertas */}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
      {error   && <Alert type="error"   message={error}   onClose={() => setError(null)}   />}

      {/* ── Toggle de vista (solo ADMIN) ── */}
      {isAdmin && (
        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
          <button
            onClick={() => setVista('registros')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
              ${vista === 'registros'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <ClipboardList size={16} />
            Registros del Operario
          </button>
          <button
            onClick={() => setVista('entregas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
              ${vista === 'entregas'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <Truck size={16} />
            Entregas del Conductor
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════
          VISTA: REGISTROS DIARIOS
      ════════════════════════════════════════════ */}
      {vista === 'registros' && (
        <>
          {/* Filtros */}
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
                <Button onClick={handleBuscar} className="flex-1">
                  <Search size={16} className="mr-2" />
                  Buscar
                </Button>
                <Button variant="outline" onClick={handleLimpiar}>
                  Limpiar
                </Button>
              </div>
            </div>
          </Card>

          {/* Tabla registros */}
          <Card>
            {loadingReg ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto" />
                <p className="mt-3 text-gray-500 text-sm">Cargando registros...</p>
              </div>
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        {isAdmin && (
                          <>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                          </>
                        )}
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Producidos</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Vendidos</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gastos</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ganancia</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {registros.map((registro) => {
                        const totalGastos = calcularTotalGastos(registro);
                        const ganancia    = Number(registro.ingresoTotal) - totalGastos;
                        return (
                          <tr key={registro.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {formatDate(registro.fecha.toString())}
                            </td>
                            {isAdmin && (
                              <>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {registro.usuario?.nombre ?? '—'}
                                </td>
                                <td className="px-4 py-3">
                                  {registro.usuario?.rol
                                    ? getRolBadge(registro.usuario.rol)
                                    : <span className="text-gray-400 text-xs">—</span>
                                  }
                                </td>
                              </>
                            )}
                            <td className="px-4 py-3 text-sm text-right">{registro.huevosProducidos}</td>
                            <td className="px-4 py-3 text-sm text-right">{registro.huevosVendidos}</td>
                            <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                              {formatCurrency(Number(registro.ingresoTotal))}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">
                              {formatCurrency(totalGastos)}
                            </td>
                            <td className={`px-4 py-3 text-sm text-right font-bold ${ganancia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(ganancia)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center gap-1">
                                <button
                                  onClick={() => router.push(`/dashboard/registros/${registro.id}`)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                  title="Ver detalle"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={() => handleDelete(registro.id, formatDate(registro.fecha.toString()))}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                                  title="Eliminar"
                                >
                                  <Trash2 size={16} />
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
                  {registros.map((registro) => {
                    const totalGastos = calcularTotalGastos(registro);
                    const ganancia    = Number(registro.ingresoTotal) - totalGastos;
                    return (
                      <div key={registro.id} className="border rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">
                              {formatDate(registro.fecha.toString())}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {registro.huevosProducidos} producidos / {registro.huevosVendidos} vendidos
                            </p>
                            {isAdmin && registro.usuario && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500">{registro.usuario.nombre}</span>
                                {getRolBadge(registro.usuario.rol)}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => router.push(`/dashboard/registros/${registro.id}`)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(registro.id, formatDate(registro.fecha.toString()))}
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-gray-500">Ingresos</p>
                            <p className="font-semibold text-green-600">{formatCurrency(Number(registro.ingresoTotal))}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Gastos</p>
                            <p className="font-semibold text-red-600">{formatCurrency(totalGastos)}</p>
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

                {/* Paginación registros */}
                {totalPagReg > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setPaginaReg((p) => Math.max(1, p - 1))}
                      disabled={paginaReg === 1}
                      className="text-gray-700"
                    >
                      Anterior
                    </Button>
                    <span className="text-sm text-gray-500">
                      Página {paginaReg} de {totalPagReg}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setPaginaReg((p) => Math.min(totalPagReg, p + 1))}
                      disabled={paginaReg === totalPagReg}
                      className="text-gray-700"
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        </>
      )}

      {/* ════════════════════════════════════════════
          VISTA: ENTREGAS DEL CONDUCTOR (solo ADMIN)
      ════════════════════════════════════════════ */}
      {vista === 'entregas' && isAdmin && (
        <Card>
          {loadingEnt ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto" />
              <p className="mt-3 text-gray-500 text-sm">Cargando entregas...</p>
            </div>
          ) : entregas.length === 0 ? (
            <div className="text-center py-12">
              <Truck size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No hay entregas registradas aún</p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conductor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Huevos</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Precio Unit.</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {entregas.map((entrega) => (
                      <tr key={entrega.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <p>{formatDate(entrega.fecha)}</p>
                          <p className="text-xs text-gray-400">{formatTime(entrega.fecha)}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {entrega.conductor?.nombre ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {entrega.clienteNombre || <span className="text-gray-400 italic">Sin nombre</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          {entrega.huevosEntregados}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          {formatCurrency(entrega.precioVentaUnitario)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                          {formatCurrency(entrega.ingresoTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-3">
                {entregas.map((entrega) => (
                  <div key={entrega.id} className="border rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{formatDate(entrega.fecha)}</p>
                        <p className="text-xs text-gray-400">{entrega.conductor?.nombre ?? '—'}</p>
                      </div>
                      <p className="font-bold text-green-600 text-sm">{formatCurrency(entrega.ingresoTotal)}</p>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{entrega.clienteNombre || 'Sin nombre'}</span>
                      <span>{entrega.huevosEntregados} huevos × {formatCurrency(entrega.precioVentaUnitario)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginación entregas */}
              {totalPagEnt > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setPaginaEnt((p) => Math.max(1, p - 1))}
                    disabled={paginaEnt === 1}
                    className="text-gray-700"
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-gray-500">
                    Página {paginaEnt} de {totalPagEnt}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPaginaEnt((p) => Math.min(totalPagEnt, p + 1))}
                    disabled={paginaEnt === totalPagEnt}
                    className="text-gray-700"
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}