'use client';
 
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, useWatch, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Skull, AlertTriangle, Egg } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
 
// ── Tipos ──────────────────────────────────────────────────────
type CategoriaHuevo = 'JUMBO' | 'AAA' | 'AA' | 'A' | 'B' | 'C';
type CategoriaGasto = { id: string; nombre: string };
 
const CATEGORIAS_HUEVO: {
  value: CategoriaHuevo;
  label: string;
  desc:  string;
  color: string;
  bg:    string;
}[] = [
  { value: 'JUMBO', label: 'Jumbo', desc: 'Extra grandes', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-300' },
  { value: 'AAA',   label: 'AAA',   desc: '1ª calidad',    color: 'text-amber-700',  bg: 'bg-amber-50  border-amber-300'  },
  { value: 'AA',    label: 'AA',    desc: '2ª calidad',    color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-300' },
  { value: 'A',     label: 'A',     desc: 'Estándar',      color: 'text-green-700',  bg: 'bg-green-50  border-green-300'  },
  { value: 'B',     label: 'B',     desc: 'Segunda',       color: 'text-blue-700',   bg: 'bg-blue-50   border-blue-300'   },
  { value: 'C',     label: 'C',     desc: 'Comercial',     color: 'text-gray-700',   bg: 'bg-gray-50   border-gray-300'   },
];
 
// ── Schema ─────────────────────────────────────────────────────
// IMPORTANTE: usamos z.input para el tipo del formulario (los campos
// llegan como string desde los inputs HTML) y z.output para el tipo
// de los datos validados que recibe onSubmit.
const gastoSchema = z.object({
  descripcion: z.string().min(1, 'Requerido'),
  monto:       z.coerce.number().min(0, 'Mínimo 0'),
  categoriaId: z.string().min(1, 'Selecciona una categoría'),
});
 
const formSchema = z
  .object({
    fecha:               z.string().min(1, 'La fecha es requerida'),
    huevosProducidos:    z.coerce.number().int().min(0, 'Mínimo 0'),
    huevosVendidos:      z.coerce.number().int().min(0, 'Mínimo 0'),
    precioVentaUnitario: z.coerce.number().min(0, 'Mínimo 0'),
    mortalidad:          z.coerce.number().int().min(0, 'Mínimo 0'),
    categoriaHuevo:      z.enum(['JUMBO', 'AAA', 'AA', 'A', 'B', 'C'] as const),
    observaciones:       z.string().optional(),
    gastos:              z.array(gastoSchema).default([]),
  })
  .refine((d) => d.huevosVendidos <= d.huevosProducidos, {
    message: 'Los vendidos no pueden superar los producidos',
    path:    ['huevosVendidos'],
  });
 
// ✅ z.input: tipo para useForm (campos como string, compatibles con inputs HTML)
// ✅ z.output: tipo para onSubmit (campos ya coercionados a number)
type FormInput  = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;
 
// ── Helpers ────────────────────────────────────────────────────
const hoy = () => new Date().toISOString().split('T')[0];
 
const formatCurrency = (v: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(v);
 
// ── Componente ─────────────────────────────────────────────────
export default function NuevoRegistroPage() {
  const router = useRouter();
  const [categoriasGasto, setCategoriasGasto] = useState<CategoriaGasto[]>([]);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
 
  // ✅ useForm tipado con FormInput para que el resolver no genere conflicto
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fecha:               hoy(),
      huevosProducidos:    0,
      huevosVendidos:      0,
      precioVentaUnitario: 600,
      mortalidad:          0,
      categoriaHuevo:      'A',
      observaciones:       '',
      gastos:              [],
    },
  });
 
  const { fields, append, remove } = useFieldArray({ control, name: 'gastos' });
 
  // ✅ useWatch en lugar de watch() — compatible con React Compiler,
  //    no genera el warning de "cannot be memoized safely"
  const producidos    = useWatch({ control, name: 'huevosProducidos'    });
  const vendidos      = useWatch({ control, name: 'huevosVendidos'      });
  const precio        = useWatch({ control, name: 'precioVentaUnitario' });
  const mortalidad    = useWatch({ control, name: 'mortalidad'          });
  const categSelec    = useWatch({ control, name: 'categoriaHuevo'      }) ?? 'A';
  const gastosWatch   = useWatch({ control, name: 'gastos'              }) ?? [];
 
  // Conversión segura: los valores de useWatch pueden llegar como string
  const numProducidos = Number(producidos)    || 0;
  const numVendidos   = Number(vendidos)      || 0;
  const numPrecio     = Number(precio)        || 0;
  const numMortalidad = Number(mortalidad)    || 0;
 
  const ingresoEstimado = numVendidos * numPrecio;
  const totalGastos     = (gastosWatch as { monto: number }[])
    .reduce((s, g) => s + (Number(g.monto) || 0), 0);
  const gananciaNeta    = ingresoEstimado - totalGastos;
  const categInfo       = CATEGORIAS_HUEVO.find((c) => c.value === categSelec);
 
  // Cargar categorías de gasto
  useEffect(() => {
    fetch('/api/categorias')
      .then((r) => r.json())
      .then((d) => { if (d.success) setCategoriasGasto(d.data); });
  }, []);
 
  // ✅ onSubmit tipado con FormOutput (datos ya validados y coercionados)
  const onSubmit: SubmitHandler<FormInput> = async (rawData) => {
    setError(null);
    // Parseamos con safeParse para obtener los tipos correctos antes de enviar
    const parsed = formSchema.safeParse(rawData);
    if (!parsed.success) {
      setError('Revisa los campos del formulario');
      return;
    }
    const data: FormOutput = parsed.data;
 
    try {
      const res  = await fetch('/api/registros', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        setSuccess(
          `✅ Registro guardado. ${data.huevosProducidos.toLocaleString()} huevos ${data.categoriaHuevo} sumados al inventario.`
        );
        setTimeout(() => router.push('/dashboard/registros'), 1800);
      } else {
        setError(json.error ?? 'Error al guardar');
      }
    } catch {
      setError('Error de conexión');
    }
  };
 
  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
 
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nuevo Registro</h1>
          <p className="text-gray-500 mt-1 text-sm">Registra la producción del día</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
      </div>
 
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
      {error   && <Alert type="error"   message={error}   onClose={() => setError(null)}   />}
 
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
 
        {/* ── 1. Fecha ── */}
        <Card title="Información General">
          <Input
            label="Fecha del Registro"
            type="date"
            {...register('fecha')}
            error={errors.fecha?.message}
          />
        </Card>
 
        {/* ── 2. Categoría de Huevo ── */}
        <Card title="Categoría de Huevo Producido">
          <p className="text-sm text-gray-500 mb-4">
            Selecciona la categoría de hoy. Los{' '}
            <strong>{numProducidos.toLocaleString()} huevos</strong>{' '}
            se sumarán a esa categoría en el inventario.
          </p>
 
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {CATEGORIAS_HUEVO.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setValue('categoriaHuevo', cat.value, { shouldValidate: true })}
                className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-all duration-150
                  ${categSelec === cat.value
                    ? `${cat.bg} border-current ring-2 ring-offset-1 ring-current scale-105 shadow-sm`
                    : 'bg-white border-gray-100 hover:border-gray-300'
                  }`}
              >
                <span className={`text-lg font-black
                  ${categSelec === cat.value ? cat.color : 'text-gray-500'}`}>
                  {cat.label}
                </span>
                <span className="text-[10px] text-gray-400 mt-0.5 text-center leading-tight">
                  {cat.desc}
                </span>
                {categSelec === cat.value && (
                  <Egg size={12} className={`mt-1 ${cat.color}`} />
                )}
              </button>
            ))}
          </div>
 
          {categInfo && (
            <div className={`mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium
              ${categInfo.bg} ${categInfo.color}`}>
              <Egg size={14} />
              Categoría seleccionada: <strong>{categInfo.label}</strong> — {categInfo.desc}
            </div>
          )}
        </Card>
 
        {/* ── 3. Producción ── */}
        <Card title="Producción del Día">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Huevos Producidos"
              type="number"
              min="0"
              {...register('huevosProducidos')}
              error={errors.huevosProducidos?.message}
            />
            <Input
              label="Huevos Vendidos"
              type="number"
              min="0"
              {...register('huevosVendidos')}
              error={errors.huevosVendidos?.message}
            />
            <Input
              label="Precio Unitario (COP)"
              type="number"
              min="0"
              step="1"
              {...register('precioVentaUnitario')}
              error={errors.precioVentaUnitario?.message}
            />
          </div>
 
          {/* Resumen financiero en tiempo real */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
              <p className="text-xs text-green-600 font-medium">Ingreso estimado</p>
              <p className="text-lg font-bold text-green-700">{formatCurrency(ingresoEstimado)}</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
              <p className="text-xs text-red-600 font-medium">Total gastos</p>
              <p className="text-lg font-bold text-red-700">{formatCurrency(totalGastos)}</p>
            </div>
            <div className={`rounded-xl p-3 text-center border
              ${gananciaNeta >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
              <p className={`text-xs font-medium
                ${gananciaNeta >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                Ganancia neta
              </p>
              <p className={`text-lg font-bold
                ${gananciaNeta >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                {formatCurrency(gananciaNeta)}
              </p>
            </div>
          </div>
        </Card>
 
        {/* ── 4. Mortalidad ── */}
        <Card title="Mortalidad del Día">
          <p className="text-sm text-gray-500 mb-3">
            Registra las aves que murieron hoy. Se descontarán del total activo de la granja.
          </p>
 
          <div className="max-w-xs">
            <Input
              label="Aves fallecidas"
              type="number"
              min="0"
              {...register('mortalidad')}
              error={errors.mortalidad?.message}
            />
          </div>
 
          {numMortalidad > 0 && (
            <div className={`mt-3 flex items-start gap-2 p-3 rounded-xl border text-sm
              ${numMortalidad >= 10
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              {numMortalidad >= 10 ? (
                <>
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>🚨 Alta mortalidad detectada. Revisar condiciones del galpón urgentemente.</span>
                </>
              ) : (
                <>
                  <Skull size={16} className="flex-shrink-0 mt-0.5" />
                  <span>Baja registrada: {numMortalidad} ave{numMortalidad > 1 ? 's' : ''}.</span>
                </>
              )}
            </div>
          )}
        </Card>
 
        {/* ── 5. Gastos ── */}
        <Card title="Gastos del Día">
          <div className="space-y-3">
            {fields.map((field, idx) => (
              <div
                key={field.id}
                className="grid grid-cols-12 gap-2 items-start bg-gray-50 rounded-xl p-3"
              >
                <div className="col-span-5">
                  <Input
                    label="Descripción"
                    {...register(`gastos.${idx}.descripcion`)}
                    error={errors.gastos?.[idx]?.descripcion?.message}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    label="Monto (COP)"
                    type="number"
                    min="0"
                    {...register(`gastos.${idx}.monto`)}
                    error={errors.gastos?.[idx]?.monto?.message}
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría
                  </label>
                  <select
                    {...register(`gastos.${idx}.categoriaId`)}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {categoriasGasto.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  {errors.gastos?.[idx]?.categoriaId && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.gastos[idx]?.categoriaId?.message}
                    </p>
                  )}
                </div>
                <div className="col-span-1 pt-7">
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
 
            <Button
              type="button"
              variant="outline"
              onClick={() => append({ descripcion: '', monto: 0, categoriaId: '' })}
              className="w-full text-gray-700 mb-1 cursor-pointer hover:bg-gray-400"
            >
              <Plus size={16} className="mr-2" />
              Añadir Gasto
            </Button>
          </div>
        </Card>
 
        {/* ── 6. Observaciones ── */}
        <Card title="Observaciones">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas adicionales (opcional)
          </label>
          <textarea
            {...register('observaciones')}
            rows={3}
            placeholder="Ej: Se cambió la iluminación del galpón 2..."
            className="w-full border border-gray-200 rounded-xl p-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
        </Card>
 
        {/* ── 7. Resumen + botón ── */}
        <Card>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-gray-500 text-xs">Producidos</p>
              <p className="font-bold text-gray-900 text-lg">{numProducidos.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500 text-xs">Vendidos</p>
              <p className="font-bold text-gray-900 text-lg">{numVendidos.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500 text-xs">Mortalidad</p>
              <p className={`font-bold text-lg ${numMortalidad > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {numMortalidad}
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-500 text-xs">Categoría</p>
              <p className={`font-bold text-lg ${categInfo?.color ?? 'text-gray-900'}`}>
                {categSelec}
              </p>
            </div>
          </div>
 
          <Button type="submit" disabled={isSubmitting} className="w-full mt-4 cursor-pointer">
            {isSubmitting
              ? 'Guardando...'
              : `Guardar Registro — ${formatCurrency(ingresoEstimado)}`
            }
          </Button>
        </Card>
 
      </form>
    </div>
  );
}