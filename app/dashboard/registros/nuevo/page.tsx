'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import type { Resolver, SubmitHandler } from "react-hook-form";
import { zodResolver } from '@hookform/resolvers/zod';
import { registroDiarioSchema, RegistroDiarioInput } from '@/lib/validations/schemas';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Trash2, Plus } from 'lucide-react';

interface Categoria {
  id: string;
  nombre: string;
}

// fuerza al resolver a tener la forma que RHF espera
const resolver = zodResolver(registroDiarioSchema) as Resolver<RegistroDiarioInput>;

export default function NuevoRegistroPage() {
  const router = useRouter();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<RegistroDiarioInput>({
    resolver,
    defaultValues: {
      fecha: new Date().toISOString().split('T')[0],
      gastos: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'gastos'
  });

  useEffect(() => {
    fetchCategorias();
  }, []);

  const fetchCategorias = async () => {
    try {
      const response = await fetch('/api/categorias');
      const data = await response.json();
      if (data.success) {
        setCategorias(data.data);
      }
    } catch (err) {
      console.error('Error al cargar categorías:', err);
    }
  };

  const onSubmit: SubmitHandler<RegistroDiarioInput> = async (data) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/registros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Error al crear registro');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (err) {
      setError('Error al conectar con el servidor');
      console.log('Error al conectar con el servidor: ', err);
    } finally {
      setLoading(false);
    }
  };

  const gastos = watch('gastos') || [];
  const totalGastos = gastos.reduce((sum, gasto) => sum + (Number(gasto.monto) || 0), 0);

  const huevosVendidos = watch('huevosVendidos') || 0;
  const precioVenta = watch('precioVentaUnitario') || 0;
  const ingresoTotal = huevosVendidos * precioVenta;
  const gananciaNeta = ingresoTotal - totalGastos;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Nuevo Registro Diario</h1>
        <p className="text-gray-600 mt-1">Registra la producción y gastos del día</p>
      </div>

      {/* Alerts */}
      {success && (
        <Alert type="success" message="¡Registro creado exitosamente! Redirigiendo..." />
      )}
      {error && (
        <Alert type="error" message={error} onClose={() => setError(null)} />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Datos de Producción */}
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

        {/* Gastos del Día */}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500"
                    {...register(`gastos.${index}.categoriaId`)}
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                  {errors.gastos?.[index]?.categoriaId && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.gastos[index]?.categoriaId?.message}
                    </p>
                  )}
                </div>
                <div className="md:col-span-1 flex items-end">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => remove(index)}
                    className="w-full"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() => append({ descripcion: '', monto: 0, categoriaId: '' })}
              className="w-full"
            >
              <Plus size={16} className="mr-2" />
              Agregar Gasto
            </Button>
          </div>
        </Card>

        {/* Resumen */}
        <Card title="Resumen del Día">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Ingresos</p>
              <p className="text-2xl font-bold text-blue-600">
                ${ingresoTotal.toLocaleString()}
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-600">Gastos</p>
              <p className="text-2xl font-bold text-red-600">
                ${totalGastos.toLocaleString()}
              </p>
            </div>
            <div className={`p-4 rounded-lg ${gananciaNeta >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-sm text-gray-600">Ganancia Neta</p>
              <p className={`text-2xl font-bold ${gananciaNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${gananciaNeta.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        {/* Botones */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            isLoading={loading}
            disabled={success}
          >
            Guardar Registro
          </Button>
        </div>
      </form>
    </div>
  );
}