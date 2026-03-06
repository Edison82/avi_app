'use client';

import { useState } from 'react';
import { useForm, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const entregaSchema = z.object({
  fecha: z.string().min(1, 'Requerido'),
  huevosEntregados: z.coerce.number().int().min(1, 'Mínimo 1'),
  precioVentaUnitario: z.coerce.number().min(0, 'Debe ser positivo'),
  clienteNombre: z.string().optional(),
  observaciones: z.string().optional(),
});
type EntregaInput = z.infer<typeof entregaSchema>;

export default function EntregasPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<EntregaInput>({
    resolver: zodResolver(entregaSchema) as Resolver<EntregaInput>,
    defaultValues: {
      fecha: new Date().toISOString().split('T')[0] }
  });

  const huevos = watch('huevosEntregados') ?? 0;
  const precio = watch('precioVentaUnitario') ?? 0;
  const totalEstimado = Number(huevos) * Number(precio);

  const onSubmit = async (data: EntregaInput) => {
    setIsLoading(true);
    setError(null);
    setExito(false);
    try {
      const res = await fetch('/api/entregas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error); return; }
      setExito(true);
      reset({ fecha: new Date().toISOString().split('T')[0] });
    } catch { setError('Error al guardar entrega'); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🚚 Registro de Entrega</h1>
        <p className="text-gray-500 text-sm mt-1">Registra la entrega de huevos del día</p>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {exito && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">✅ Entrega registrada exitosamente</div>}

      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input {...register('fecha')} type="date"
                max={new Date().toISOString().split('T')[0]}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              {errors.fecha && <p className="text-red-500 text-xs mt-1">{errors.fecha.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Huevos entregados</label>
              <input {...register('huevosEntregados')} type="number" placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              {errors.huevosEntregados && <p className="text-red-500 text-xs mt-1">{errors.huevosEntregados.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio por unidad</label>
              <input {...register('precioVentaUnitario')} type="number" step="0.01" placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              {errors.precioVentaUnitario && <p className="text-red-500 text-xs mt-1">{errors.precioVentaUnitario.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente (opcional)</label>
              <input {...register('clienteNombre')} placeholder="Nombre del cliente"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea {...register('observaciones')} rows={3} placeholder="Notas adicionales..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>

          {/* Total estimado */}
          {totalEstimado > 0 && (
            <div className="p-4 bg-amber-50 rounded-lg flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total estimado:</span>
              <span className="text-lg font-bold text-amber-700">
                ${totalEstimado.toFixed(2)}
              </span>
            </div>
          )}

          <button type="submit" disabled={isLoading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50">
            {isLoading ? 'Guardando...' : 'Registrar Entrega'}
          </button>
        </form>
      </div>
    </div>
  );
}