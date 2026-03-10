'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, SubmitHandler, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSession } from 'next-auth/react';
import { z } from 'zod';
import { Building2, Bird, Calendar, ArrowRight } from 'lucide-react';

const setupSchema = z.object({
  nombreGranja: z.string().min(3, 'Mínimo 3 caracteres'),
  numeroAves: z.coerce.number().int().min(1, 'Debe tener al menos 1 ave'),
  fechaIngreso: z.string().min(1, 'La fecha es requerida'),
});

type SetupInput = z.infer<typeof setupSchema>;

export default function SetupPage() {
  const router = useRouter();
  const { update } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupInput>({
    resolver: zodResolver(setupSchema) as Resolver<SetupInput>,
    defaultValues: { nombreGranja: '', numeroAves: undefined, fechaIngreso: '' },
  });

  const onSubmit: SubmitHandler<SetupInput> = async (data) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setup/granja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || 'Error al guardar la granja');
        return;
      }

      // Actualizar la sesión con los nuevos datos
      await update({
        setupCompleto: true,
        granjaId: json.data.granjaId,
      });

      // Pequeño delay para que la sesión se actualice
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 500);
    } catch (err) {
      console.error('Error en setup:', err);
      setError('Error al guardar la granja. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      {/* Card principal */}
      <div className="w-full max-w-lg">
        {/* Header fuera del card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-2xl mb-4 text-3xl shadow-sm">
            🐔
          </div>
          <h1 className="text-3xl font-bold text-gray-900">AviControl</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Configura tu granja para empezar
          </p>
        </div>

        {/* Indicador de progreso */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center shadow">
              1
            </div>
            <span className="text-xs font-medium text-amber-600">
              Tu granja
            </span>
          </div>
          <div className="w-8 h-px bg-gray-300" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-400 text-xs font-bold flex items-center justify-center">
              2
            </div>
            <span className="text-xs text-gray-400">Dashboard</span>
          </div>
        </div>

        {/* Card formulario */}
        <div className="bg-white rounded-2xl shadow-lg border border-amber-100 p-8">
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Nombre granja */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <Building2 size={15} className="text-amber-500" />
                Nombre de la Granja
              </label>
              <input
                {...register('nombreGranja')}
                placeholder="Ej: Granja El Porvenir"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
              />
              {errors.nombreGranja && (
                <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                  <span>•</span> {errors.nombreGranja.message}
                </p>
              )}
            </div>

            {/* Número de aves */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <Bird size={15} className="text-amber-500" />
                Número de Aves
              </label>
              <input
                {...register('numeroAves')}
                type="number"
                placeholder="Ej: 500"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
              />
              {errors.numeroAves && (
                <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                  <span>•</span> {errors.numeroAves.message}
                </p>
              )}
            </div>

            {/* Fecha ingreso */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <Calendar size={15} className="text-amber-500" />
                Fecha de Ingreso de las Aves
              </label>
              <input
                {...register('fechaIngreso')}
                type="date"
                max={new Date().toISOString().split('T')[0]}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
              />
              {errors.fechaIngreso && (
                <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                  <span>•</span> {errors.fechaIngreso.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm hover:shadow-md mt-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creando tu granja...
                </>
              ) : (
                <>
                  Crear mi Granja
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Podrás modificar estos datos después en Configuración
        </p>
      </div>
    </div>
  );
}
