'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { Eye, Trash2, Search } from 'lucide-react';
import { RegistroDiarioConRelaciones } from '@/types';

export default function RegistrosPage() {
  const router = useRouter();
  const [registros, setRegistros] = useState<RegistroDiarioConRelaciones[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filtros
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  
  // Paginación
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);

  useEffect(() => {
    const fetchRegistros = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          pagina: pagina.toString(),
          limite: '10'
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
        console.log('Error al cargar registros: ', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRegistros();
  }, [pagina, fechaDesde, fechaHasta]);

  const handleBuscarRegistros = () => {
    setPagina(1);
  }

  const handleDelete = async (id: string, fecha: string) => {
    if (!confirm(`¿Estás seguro de eliminar el registro del ${fecha}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/registros/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Registro eliminado exitosamente');
        handleBuscarRegistros();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al eliminar registro');
      console.log('Error al eliminar registro: ', err);
    }
  };

  const handleLimpiarFiltros = () => {
    setFechaDesde('');
    setFechaHasta('');
    setPagina(1);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calcularTotalGastos = (registro: RegistroDiarioConRelaciones) => {
    return registro.gastos.reduce((sum, gasto) => sum + Number(gasto.monto), 0);
  };

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
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

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

      {/* Tabla de Registros */}
      <Card>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
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
            {/* Vista Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
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
                    const ganancia = Number(registro.ingresoTotal) - totalGastos;
                    
                    return (
                      <tr key={registro.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDate(registro.fecha.toString())}
                        </td>
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
                        <td className={`px-4 py-3 text-sm text-right font-bold ${ganancia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
                              onClick={() => handleDelete(registro.id, formatDate(registro.fecha.toString()))}
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

            {/* Vista Mobile */}
            <div className="md:hidden space-y-4">
              {registros.map((registro) => {
                const totalGastos = calcularTotalGastos(registro);
                const ganancia = Number(registro.ingresoTotal) - totalGastos;
                
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
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => router.push(`/dashboard/registros/${registro.id}`)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(registro.id, formatDate(registro.fecha.toString()))}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
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
                  onClick={() => setPagina(p => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm text-gray-600">
                  Página {pagina} de {totalPaginas}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                  disabled={pagina === totalPaginas}
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