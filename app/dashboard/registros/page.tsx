'use client';
 
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { Eye, Trash2, Search } from 'lucide-react';
import { RegistroDiarioConRelaciones } from '@/types';
 
// ✅ Tipo inline que refleja exactamente el select del API
// (id, nombre, email, rol del modelo Usuario en schema.prisma)
type UsuarioResumen = {
  id:     string;
  nombre: string;
  email:  string;
  rol:    'ADMIN' | 'OPERARIO' | 'CONDUCTOR'; // enum Rol del schema
};
 
// Extendemos el tipo existente para incluir el usuario que creó el registro
type RegistroConUsuario = RegistroDiarioConRelaciones & {
  usuario?: UsuarioResumen | null;
};
 
export default function RegistrosPage() {
  const router = useRouter();
  const { data: session } = useSession();
  
  // ✅ Detecta si el usuario logueado es ADMIN para mostrar columnas extra
  const isAdmin = session?.user?.rol === 'ADMIN';
 
  const [registros, setRegistros]         = useState<RegistroConUsuario[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [success, setSuccess]             = useState<string | null>(null);
  const [fechaDesde, setFechaDesde]       = useState('');
  const [fechaHasta, setFechaHasta]       = useState('');
  const [pagina, setPagina]               = useState(1);
  const [totalPaginas, setTotalPaginas]   = useState(1);
 
  useEffect(() => {
    const fetchRegistros = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          pagina: pagina.toString(),
          limite: '10',
        });
        if (fechaDesde) params.append('fechaDesde', fechaDesde);
        if (fechaHasta) params.append('fechaHasta', fechaHasta);
 
        const response = await fetch(`/api/registros?${params}`);
        const data = await response.json();
 
        if (data.success) {
          setRegistros(data.data);
          setTotalPaginas(data.pagination.totalPaginas);
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError('Error al cargar registros');
        console.error('Error al cargar registros:', err);
      } finally {
        setLoading(false);
      }
    };
 
    fetchRegistros();
  }, [pagina, fechaDesde, fechaHasta]);
 
  const handleBuscarRegistros = () => setPagina(1);
 
  const handleDelete = async (id: string, fecha: string) => {
    if (!confirm(`¿Estás seguro de eliminar el registro del ${fecha}?`)) return;
 
    try {
      const response = await fetch(`/api/registros/${id}`, { method: 'DELETE' });
      const data = await response.json();
 
      if (data.success) {
        setSuccess('Registro eliminado exitosamente');
        // Actualización optimista: elimina del estado local sin re-fetch
        setRegistros((prev) => prev.filter((r) => r.id !== id));
        // Si era el último de la página, retrocede una página
        if (registros.length === 1 && pagina > 1) {
          setPagina((p) => p - 1);
        }
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error ?? 'No se pudo eliminar el registro');
      }
    } catch (err) {
      setError('Error al eliminar registro');
      console.error('Error al eliminar registro:', err);
    }
  };
 
  const handleLimpiarFiltros = () => {
    setFechaDesde('');
    setFechaHasta('');
    setPagina(1);
  };
 
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
 
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
 
  // Badge de color por cada valor del enum Rol
  const getRolBadge = (rol: UsuarioResumen['rol']) => {
    const estilos: Record<UsuarioResumen['rol'], { label: string; color: string }> = {
      ADMIN:     { label: 'Admin',     color: 'bg-purple-100 text-purple-700' },
      OPERARIO:  { label: 'Operario',  color: 'bg-blue-100   text-blue-700'   },
      CONDUCTOR: { label: 'Conductor', color: 'bg-orange-100 text-orange-700' },
    };
    const { label, color } = estilos[rol];
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };
 
  const calcularTotalGastos = (registro: RegistroConUsuario) =>
    registro.gastos.reduce((sum, gasto) => sum + Number(gasto.monto), 0);
 
  return (
    <div className="space-y-6">
 
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Historial de Registros</h1>
          <p className="text-gray-600 mt-1">Consulta y gestiona tus registros diarios</p>
        </div>
        <Button onClick={() => router.push('/dashboard/registros/nuevo')}>
          + Nuevo Registro
        </Button>
      </div>
 
      {/* Alerts */}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
      {error   && <Alert type="error"   message={error}   onClose={() => setError(null)}   />}
 
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
          <div className="flex items-end space-x-2">
            <Button onClick={handleBuscarRegistros} className="flex-1">
              <Search size={16} className="mr-2" />
              Buscar
            </Button>
            <Button variant="outline" onClick={handleLimpiarFiltros}>
              Limpiar
            </Button>
          </div>
        </div>
      </Card>
 
      {/* Tabla */}
      <Card>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
            <p className="mt-4 text-gray-600">Cargando registros...</p>
          </div>
        ) : registros.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No hay registros para mostrar</p>
            <Button onClick={() => router.push('/dashboard/registros/nuevo')}>
              Crear Primer Registro
            </Button>
          </div>
        ) : (
          <>
            {/* ── Vista Desktop ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Fecha
                    </th>
 
                    {/* Columnas exclusivas del ADMIN */}
                    {isAdmin && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Usuario
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Tipo
                        </th>
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
 
                        {/* Celdas exclusivas del ADMIN */}
                        {isAdmin && (
                          <>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {/* nombre del modelo Usuario (campo: nombre String) */}
                              {registro.usuario?.nombre ?? '—'}
                            </td>
                            <td className="px-4 py-3">
                              {registro.usuario?.rol
                                ? getRolBadge(registro.usuario.rol)
                                : <span className="text-gray-400">—</span>
                              }
                            </td>
                          </>
                        )}
 
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {registro.huevosProducidos}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {registro.huevosVendidos}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                          {formatCurrency(Number(registro.ingresoTotal))}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">
                          {formatCurrency(totalGastos)}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-bold ${
                          ganancia >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(ganancia)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center space-x-2">
                            <button
                              onClick={() => router.push(`/dashboard/registros/${registro.id}`)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                              title="Ver detalle"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(
                                registro.id,
                                formatDate(registro.fecha.toString())
                              )}
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
 
            {/* ── Vista Mobile ── */}
            <div className="md:hidden space-y-4">
              {registros.map((registro) => {
                const totalGastos = calcularTotalGastos(registro);
                const ganancia    = Number(registro.ingresoTotal) - totalGastos;
 
                return (
                  <div key={registro.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {formatDate(registro.fecha.toString())}
                        </p>
                        <p className="text-sm text-gray-600">
                          {registro.huevosProducidos} producidos / {registro.huevosVendidos} vendidos
                        </p>
 
                        {/* Info de usuario solo visible para ADMIN en mobile */}
                        {isAdmin && registro.usuario && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">
                              {registro.usuario.nombre}
                            </span>
                            {getRolBadge(registro.usuario.rol)}
                          </div>
                        )}
                      </div>
 
                      <div className="flex space-x-2">
                        <button
                          onClick={() => router.push(`/dashboard/registros/${registro.id}`)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          title="Ver detalle"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(
                            registro.id,
                            formatDate(registro.fecha.toString())
                          )}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
 
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-gray-600">Ingresos</p>
                        <p className="font-medium text-green-600">
                          {formatCurrency(Number(registro.ingresoTotal))}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Gastos</p>
                        <p className="font-medium text-red-600">
                          {formatCurrency(totalGastos)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Ganancia</p>
                        <p className={`font-bold ${ganancia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(ganancia)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
 
            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                  className='text-gray-800 hover:bg-gray-400 cursor-pointer'
                >
                  Anterior
                </Button>
                <span className="text-sm text-gray-600">
                  Página {pagina} de {totalPaginas}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  disabled={pagina === totalPaginas}
                  className='text-gray-800 hover:bg-gray-400 cursor-pointer'
                >
                  Siguiente
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}