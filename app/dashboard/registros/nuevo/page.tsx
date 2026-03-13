'use client';
 
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import type { Resolver, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registroDiarioSchema, RegistroDiarioInput } from '@/lib/validations/schemas';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Trash2, Plus, Skull } from 'lucide-react';
 
interface Categoria {
  id:     string;
  nombre: string;
}
 
const resolver = zodResolver(registroDiarioSchema) as Resolver<RegistroDiarioInput>;
 
export default function NuevoRegistroPage() {
  const router = useRouter();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);
 
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegistroDiarioInput>({
    resolver,
    defaultValues: {
      fecha:            new Date().toISOString().split('T')[0],
      mortalidad:       0,
      gastos:           [],
    },
  });
 
  const { fields, append, remove } = useFieldArray({ control, name: 'gastos' });
 
  useEffect(() => {
    async function fetchCategorias() {
      try {
        const res  = await fetch('/api/categorias');
        const data = await res.json();
        if (data.success) setCategorias(data.data);
      } catch (err) {
        console.error('Error al cargar categorías:', err);
      }
    }
    fetchCategorias();
  }, []);
 
  const onSubmit: SubmitHandler<RegistroDiarioInput> = async (data) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/registros', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      const result = await response.json();
 
      if (!response.ok) {
        setError(result.error || 'Error al crear registro');
        return;
      }
 
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err) {
      setError('Error al conectar con el servidor');
      console.error('Error al conectar con el servidor:', err);
    } finally {
      setLoading(false);
    }
  };
 
  // Valores en tiempo real para el resumen
  const gastos          = watch('gastos') || [];
  const totalGastos     = gastos.reduce((sum, g) => sum + (Number(g.monto) || 0), 0);
  const huevosVendidos  = watch('huevosVendidos')    || 0;
  const precioVenta     = watch('precioVentaUnitario') || 0;
  const mortalidad      = watch('mortalidad')          || 0;
  const ingresoTotal    = huevosVendidos * precioVenta;
  const gananciaNeta    = ingresoTotal - totalGastos;
 
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
 
  return (
    <div className="max-w-4xl mx-auto space-y-6">
 
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Nuevo Registro Diario</h1>
        <p className="text-gray-600 mt-1">Registra la producción, mortalidad y gastos del día</p>
      </div>
 
      {success && <Alert type="success" message="¡Registro creado exitosamente! Redirigiendo..." />}
      {error   && <Alert type="error"   message={error} onClose={() => setError(null)} />}
 
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
 
        {/* ── Datos de Producción ── */}
        <Card title="Datos de Producción">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Fecha"
              type="date"
              error={errors.fecha?.message}
              {...register('fecha')}
            />
            <Input
              label="Huevos Producidos"
              type="number"
              placeholder="0"
              error={errors.huevosProducidos?.message}
              {...register('huevosProducidos', { valueAsNumber: true })}
            />
            <Input
              label="Huevos Vendidos"
              type="number"
              placeholder="0"
              error={errors.huevosVendidos?.message}
              {...register('huevosVendidos', { valueAsNumber: true })}
            />
            <Input
              label="Precio de Venta Unitario"
              type="number"
              placeholder="0"
              error={errors.precioVentaUnitario?.message}
              {...register('precioVentaUnitario', { valueAsNumber: true })}
            />
          </div>
 
          <div className="mt-4">
            <Input
              label="Observaciones (opcional)"
              placeholder="Notas adicionales del día..."
              error={errors.observaciones?.message}
              {...register('observaciones')}
            />
          </div>
        </Card>
 
        {/* ── Mortalidad ── */}
        <Card title="Mortalidad del Día">
          <div className="flex items-start gap-4">
            {/* Ícono visual */}
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center mt-1">
              <Skull size={20} className="text-red-400" />
            </div>
 
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-3">
                Registra el número de aves que murieron hoy. Este valor se descontará
                automáticamente del total de aves activas de tu granja.
              </p>
              <div className="max-w-xs">
                <Input
                  label="Aves muertas hoy"
                  type="number"
                  placeholder="0"
                  error={errors.mortalidad?.message}
                  {...register('mortalidad', { valueAsNumber: true })}
                />
              </div>
 
              {/* Alerta visual si mortalidad es alta */}
              {mortalidad > 0 && (
                <div className={`mt-3 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2
                  ${mortalidad >= 10
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                  <span>{mortalidad >= 10 ? '🚨' : '⚠️'}</span>
                  <span>
                    {mortalidad >= 10
                      ? `Alta mortalidad: ${mortalidad} aves. Considera revisar las condiciones del galpón.`
                      : `Se registrarán ${mortalidad} ave${mortalidad > 1 ? 's' : ''} como baja del día.`
                    }
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>
 
        {/* ── Gastos del Día ── */}
        <Card title="Gastos del Día">
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="md:col-span-5">
                  <Input
                    label="Descripción"
                    placeholder="Ej: Bulto de concentrado"
                    error={errors.gastos?.[index]?.descripcion?.message}
                    {...register(`gastos.${index}.descripcion`)}
                  />
                </div>
                <div className="md:col-span-3">
                  <Input
                    label="Monto"
                    type="number"
                    placeholder="0"
                    error={errors.gastos?.[index]?.monto?.message}
                    {...register(`gastos.${index}.monto`, { valueAsNumber: true })}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                    {...register(`gastos.${index}.categoriaId`)}
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                  {errors.gastos?.[index]?.categoriaId && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.gastos[index]?.categoriaId?.message}
                    </p>
                  )}
                </div>
                <div className="md:col-span-1 flex items-end">
                  <Button type="button" variant="danger" size="sm" onClick={() => remove(index)} className="w-full">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
 
            <Button
              type="button"
              variant="outline"
              onClick={() => append({ descripcion: '', monto: 0, categoriaId: '' })}
              className="w-full text-gray-900 bg-green-500 hover:text-white cursor-pointer"
            >
              <Plus size={16} className="mr-2" />
              Agregar Gasto
            </Button>
          </div>
        </Card>
 
        {/* ── Resumen ── */}
        <Card title="Resumen del Día">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Ingresos</p>
              <p className="text-xl font-bold text-blue-600">{fmt(ingresoTotal)}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Gastos</p>
              <p className="text-xl font-bold text-red-600">{fmt(totalGastos)}</p>
            </div>
            <div className={`p-4 rounded-lg ${gananciaNeta >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-xs text-gray-500 mb-1">Ganancia Neta</p>
              <p className={`text-xl font-bold ${gananciaNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(gananciaNeta)}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Bajas del día</p>
              <p className={`text-xl font-bold ${mortalidad > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {mortalidad} ave{mortalidad !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </Card>
 
        {/* Botones */}
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={loading} disabled={success}>
            Guardar Registro
          </Button>
        </div>
      </form>
    </div>
  );
}