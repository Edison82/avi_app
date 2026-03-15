'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Package, ChevronLeft, ChevronRight,
  Pencil, Trash2, X, AlertTriangle,
} from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────
type CategoriaHuevo = 'JUMBO' | 'AAA' | 'AA' | 'A' | 'B' | 'C';

const CATEGORIAS: CategoriaHuevo[] = ['JUMBO', 'AAA', 'AA', 'A', 'B', 'C'];
const HUEVOS_POR_CUBETA = 30;
const LIMITE = 4;

interface StockItem {
  categoriaHuevo:  CategoriaHuevo;
  cantidadHuevos:  number;
  cantidadCubetas: number;
}

interface CargaResponse {
  id:                 string;
  fecha:              string;
  categoriaHuevo:     CategoriaHuevo;
  cubetas:            number;
  huevosEquivalentes: number;
  observaciones?:     string | null;
  conductor?:         { nombre: string } | null;
}

// ── Schema ─────────────────────────────────────────────────────
const cargaSchema = z.object({
  categoriaHuevo: z.enum(['JUMBO', 'AAA', 'AA', 'A', 'B', 'C'] as const),
  cubetas:        z.coerce.number().int().min(1, 'Mínimo 1 cubeta'),
  observaciones:  z.string().optional(),
});
type CargaInput  = z.input<typeof cargaSchema>;
type CargaOutput = z.output<typeof cargaSchema>;

// ── Colores por categoría ──────────────────────────────────────
const CAT_STYLE: Record<CategoriaHuevo, { badge: string; ring: string; bg: string; text: string }> = {
  JUMBO: { badge: 'bg-violet-100 text-violet-700', ring: 'ring-violet-400', bg: 'bg-violet-50 border-violet-300', text: 'text-violet-700' },
  AAA:   { badge: 'bg-amber-100  text-amber-700',  ring: 'ring-amber-400',  bg: 'bg-amber-50  border-amber-300',  text: 'text-amber-700'  },
  AA:    { badge: 'bg-yellow-100 text-yellow-700', ring: 'ring-yellow-400', bg: 'bg-yellow-50 border-yellow-300', text: 'text-yellow-700' },
  A:     { badge: 'bg-green-100  text-green-700',  ring: 'ring-green-400',  bg: 'bg-green-50  border-green-300',  text: 'text-green-700'  },
  B:     { badge: 'bg-blue-100   text-blue-700',   ring: 'ring-blue-400',   bg: 'bg-blue-50   border-blue-300',   text: 'text-blue-700'   },
  C:     { badge: 'bg-gray-100   text-gray-600',   ring: 'ring-gray-400',   bg: 'bg-gray-50   border-gray-300',   text: 'text-gray-600'   },
};

const formatDateShort = (s: string) =>
  new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

const formatTime = (s: string) =>
  new Date(s).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

// ── Funciones de fetch puras (fuera del componente) ────────────
// Al estar fuera del componente no son dependencias de useEffect
// y el React Compiler no las marca como setState síncronas.
async function fetchCargas(pag: number) {
  const res  = await fetch(`/api/cargas?pagina=${pag}&limite=${LIMITE}`);
  const json = await res.json();
  return json.success ? { data: json.data, total: json.pagination.total } : null;
}

async function fetchStock() {
  const res  = await fetch('/api/inventario');
  const json = await res.json();
  return json.success ? (json.data as StockItem[]) : null;
}

// ── Componente principal ───────────────────────────────────────
export default function CargaPage() {
  const [cargas,     setCargas]     = useState<CargaResponse[]>([]);
  const [stock,      setStock]      = useState<StockItem[]>([]);
  const [total,      setTotal]      = useState(0);
  const [pagina,     setPagina]     = useState(1);
  const [editando,   setEditando]   = useState<CargaResponse | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [alerta,     setAlerta]     = useState<{ msg: string; tipo: 'ok' | 'err' | 'warn' } | null>(null);
  // Ref para trigger de recarga manual (evita añadir funciones a deps)
  const [reloadKey, setReloadKey]   = useState(0);

  const totalPaginas = Math.ceil(total / LIMITE) || 1;

  // ── useEffect con async inline ────────────────────────────────
  // El React Compiler acepta esta forma porque setState se llama dentro
  // de una función async, no de forma síncrona en el cuerpo del effect.
  useEffect(() => {
    let cancelled = false;

    async function cargar() {
      const [resultCargas, resultStock] = await Promise.all([
        fetchCargas(pagina),
        fetchStock(),
      ]);
      if (cancelled) return;
      if (resultCargas) {
        setCargas(resultCargas.data);
        setTotal(resultCargas.total);
      }
      if (resultStock) {
        setStock(resultStock);
      }
    }

    cargar();

    // Cleanup: si el componente se desmonta o las deps cambian antes
    // de que el fetch termine, no aplicamos el setState obsoleto.
    return () => { cancelled = true; };
  }, [pagina, reloadKey]);  // reloadKey permite forzar recarga sin cambiar pagina

  const recargar = (nuevaPagina?: number) => {
    if (nuevaPagina !== undefined) setPagina(nuevaPagina);
    setReloadKey((k) => k + 1);
  };

  const mostrarAlerta = (msg: string, tipo: 'ok' | 'err' | 'warn') => {
    setAlerta({ msg, tipo });
    setTimeout(() => setAlerta(null), 4000);
  };

  // ── Formulario ──────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CargaInput>({
    resolver: zodResolver(cargaSchema),
    defaultValues: { categoriaHuevo: 'A', cubetas: 1 },
  });

  const categSelec = (useWatch({ control, name: 'categoriaHuevo' }) ?? 'A') as CategoriaHuevo;
  const cubetasRaw = useWatch({ control, name: 'cubetas' });
  const cubetasVal = Number(cubetasRaw) || 0;

  const stockCateg = stock.find((s) => s.categoriaHuevo === categSelec);
  const huevosEst  = cubetasVal * HUEVOS_POR_CUBETA;
  const sinStock   = stockCateg ? huevosEst > stockCateg.cantidadHuevos : huevosEst > 0;

  const onSubmit: SubmitHandler<CargaInput> = async (rawData) => {
    const parsed = cargaSchema.safeParse(rawData);
    if (!parsed.success) return;
    const data: CargaOutput = parsed.data;

    const res  = await fetch('/api/cargas', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    const json = await res.json();
    if (json.success) {
      reset({ categoriaHuevo: 'A', cubetas: 1 });
      mostrarAlerta(`✅ ${json.message}`, 'ok');
      recargar(1);
    } else {
      mostrarAlerta(
        `${res.status === 422 ? '⚠️' : '❌'} ${json.error}`,
        res.status === 422 ? 'warn' : 'err'
      );
    }
  };

  // ── Eliminar ────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta carga? Los huevos serán devueltos al inventario.')) return;
    setDeletingId(id);
    const res  = await fetch(`/api/cargas/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      mostrarAlerta(`🔄 ${json.message}`, 'ok');
      const nuevaPag = cargas.length === 1 && pagina > 1 ? pagina - 1 : pagina;
      recargar(nuevaPag);
    } else {
      mostrarAlerta(`❌ ${json.error}`, 'err');
    }
    setDeletingId(null);
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package size={24} className="text-amber-500" />
          Registro de Carga
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Especifica las cubetas que llevas. Se descontarán del inventario de la granja.
        </p>
      </div>

      {/* Alerta */}
      {alerta && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium border
          ${alerta.tipo === 'ok'   ? 'bg-green-50 text-green-700 border-green-200' :
            alerta.tipo === 'warn' ? 'bg-amber-50  text-amber-700  border-amber-200' :
                                     'bg-red-50    text-red-700    border-red-200'}`}>
          <span>{alerta.msg}</span>
          <button onClick={() => setAlerta(null)}><X size={15} /></button>
        </div>
      )}

      {/* Stock rápido por categoría */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Stock disponible por categoría
        </p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {stock.map((s) => {
            const style   = CAT_STYLE[s.categoriaHuevo];
            const activa  = categSelec === s.categoriaHuevo;
            const agotado = s.cantidadHuevos === 0;
            return (
              <button
                key={s.categoriaHuevo}
                type="button"
                onClick={() => setValue('categoriaHuevo', s.categoriaHuevo, { shouldValidate: true })}
                className={`rounded-2xl border-2 p-3 text-center transition-all duration-150
                  ${activa
                    ? `${style.bg} ring-2 ${style.ring} ring-offset-1 scale-105 shadow-sm`
                    : 'bg-white border-gray-100 hover:border-gray-300'
                  }
                  ${agotado ? 'opacity-50' : ''}`}
              >
                <p className={`text-base font-black ${activa ? style.text : 'text-gray-500'}`}>
                  {s.categoriaHuevo}
                </p>
                <p className={`text-lg font-black mt-0.5 ${activa ? style.text : 'text-gray-700'}`}>
                  {s.cantidadCubetas}
                </p>
                <p className="text-[10px] text-gray-400">cubetas</p>
                {agotado && (
                  <span className="text-[9px] font-bold text-red-500 block mt-0.5">AGOTADO</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        {/* ── FORMULARIO ── */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-2xl border shadow-sm p-6 space-y-5"
        >
          <h2 className="font-bold text-gray-800">Nueva Carga</h2>

          {/* Selector de categoría */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoría de Huevo *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIAS.map((cat) => {
                const style   = CAT_STYLE[cat];
                const s       = stock.find((x) => x.categoriaHuevo === cat);
                const agotado = s ? s.cantidadHuevos === 0 : true;
                const activa  = categSelec === cat;
                return (
                  <label
                    key={cat}
                    className={`flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer
                      select-none transition-all
                      ${activa
                        ? `${style.bg} border-current ring-2 ${style.ring}`
                        : 'border-gray-100 hover:border-gray-300'
                      }
                      ${agotado ? 'opacity-50' : ''}`}
                  >
                    <input
                      {...register('categoriaHuevo')}
                      type="radio"
                      value={cat}
                      className="sr-only"
                    />
                    <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${style.badge}`}>
                      {cat}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-1">
                      {s ? `${s.cantidadCubetas} cub.` : '0 cub.'}
                    </span>
                    {agotado && <AlertTriangle size={10} className="text-red-400 mt-0.5" />}
                  </label>
                );
              })}
            </div>
            {errors.categoriaHuevo && (
              <p className="text-red-500 text-xs mt-1">{errors.categoriaHuevo.message}</p>
            )}
          </div>

          {/* Cubetas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cantidad de Cubetas *
              <span className="ml-1 text-xs text-gray-400 font-normal">
                ({HUEVOS_POR_CUBETA} huevos c/u)
              </span>
            </label>
            <input
              {...register('cubetas')}
              type="number"
              min="1"
              className="w-full border border-gray-200 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {errors.cubetas && (
              <p className="text-red-500 text-xs mt-1">{errors.cubetas.message}</p>
            )}
          </div>

          {/* Preview de stock */}
          <div className={`rounded-xl p-3 border text-sm space-y-1
            ${sinStock ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-100'}`}>
            <div className="flex justify-between">
              <span className="text-gray-600">Huevos a cargar:</span>
              <span className={`font-bold ${sinStock ? 'text-red-600' : 'text-amber-700'}`}>
                {huevosEst.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Disponibles ({categSelec}):</span>
              <span className="font-semibold text-gray-700">
                {(stockCateg?.cantidadHuevos ?? 0).toLocaleString()} huevos
              </span>
            </div>
            {sinStock && (
              <p className="flex items-center gap-1 text-red-600 text-xs font-medium pt-1">
                <AlertTriangle size={12} />
                Stock insuficiente para esta carga
              </p>
            )}
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones
            </label>
            <textarea
              {...register('observaciones')}
              rows={2}
              placeholder="Destino, cliente, ruta..."
              className="w-full border border-gray-200 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || sinStock}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold text-sm
                       transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? 'Registrando...'
              : `Cargar ${cubetasVal} cubeta${cubetasVal !== 1 ? 's' : ''} de ${categSelec}`
            }
          </button>
        </form>

        {/* ── TABLA DE CARGAS ── */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">Mis Cargas</h2>
            <span className="text-xs text-gray-400">
              {total} registro{total !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left   text-xs font-medium text-gray-500">Fecha</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Cat.</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Cubetas</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Huevos</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cargas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-400 text-sm">
                      Sin cargas registradas
                    </td>
                  </tr>
                ) : (
                  cargas.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-xs text-gray-600">
                        <p className="whitespace-nowrap">{formatDateShort(c.fecha)}</p>
                        <p className="text-gray-400">{formatTime(c.fecha)}</p>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${CAT_STYLE[c.categoriaHuevo].badge}`}>
                          {c.categoriaHuevo}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-gray-800 text-sm">
                        {c.cubetas}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-600">
                        {c.huevosEquivalentes.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => setEditando(c)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={deletingId === c.id}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                            title="Eliminar"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="px-4 py-3 border-t flex items-center justify-between bg-gray-50">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-gray-500">Página {pagina} de {totalPaginas}</span>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal editar */}
      {editando && (
        <ModalEditarCarga
          carga={editando}
          stock={stock}
          onClose={() => setEditando(null)}
          onGuardado={(msg) => {
            setEditando(null);
            mostrarAlerta(`✅ ${msg}`, 'ok');
            recargar(pagina);
          }}
          onError={(msg) => mostrarAlerta(`❌ ${msg}`, 'err')}
        />
      )}
    </div>
  );
}

// ── Modal Editar Carga ─────────────────────────────────────────
function ModalEditarCarga({
  carga, stock, onClose, onGuardado, onError,
}: {
  carga:      CargaResponse;
  stock:      StockItem[];
  onClose:    () => void;
  onGuardado: (msg: string) => void;
  onError:    (msg: string) => void;
}) {
  const editSchema = z.object({
    categoriaHuevo: z.enum(['JUMBO', 'AAA', 'AA', 'A', 'B', 'C'] as const),
    cubetas:        z.coerce.number().int().min(1),
    observaciones:  z.string().optional(),
  });
  type EditInput  = z.input<typeof editSchema>;
  type EditOutput = z.output<typeof editSchema>;

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } =
    useForm<EditInput>({
      resolver:      zodResolver(editSchema),
      defaultValues: {
        categoriaHuevo: carga.categoriaHuevo,
        cubetas:        carga.cubetas,
        observaciones:  carga.observaciones ?? '',
      },
    });

  const catEdit = (useWatch({ control, name: 'categoriaHuevo' }) ?? carga.categoriaHuevo) as CategoriaHuevo;
  const cubRaw  = useWatch({ control, name: 'cubetas' });
  const cubEdit = Number(cubRaw) || 0;

  const stockItem = stock.find((s) => s.categoriaHuevo === catEdit);
  const stockReal = catEdit === carga.categoriaHuevo
    ? (stockItem?.cantidadHuevos ?? 0) + carga.huevosEquivalentes
    : (stockItem?.cantidadHuevos ?? 0);
  const nuevosHuevos      = cubEdit * HUEVOS_POR_CUBETA;
  const stockInsuficiente = nuevosHuevos > stockReal;

  const onSubmit: SubmitHandler<EditInput> = async (rawData) => {
    const parsed = editSchema.safeParse(rawData);
    if (!parsed.success) return;
    const data: EditOutput = parsed.data;

    const res  = await fetch(`/api/cargas/${carga.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    const json = await res.json();
    if (json.success) onGuardado('Carga actualizada. Inventario ajustado.');
    else onError(json.error ?? 'Error al actualizar');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-bold text-gray-900">Editar Carga</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIAS.map((cat) => {
                const style  = CAT_STYLE[cat];
                const activa = catEdit === cat;
                return (
                  <label
                    key={cat}
                    className={`flex items-center justify-center p-2.5 rounded-xl border-2 cursor-pointer
                      text-sm font-bold transition-all
                      ${activa
                        ? `${style.bg} border-current ring-2 ${style.ring}`
                        : 'border-gray-100 hover:border-gray-300'
                      }`}
                  >
                    <input
                      {...register('categoriaHuevo')}
                      type="radio"
                      value={cat}
                      className="sr-only"
                    />
                    <span className={`px-2 py-0.5 rounded-lg text-xs ${style.badge}`}>{cat}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cubetas</label>
            <input
              {...register('cubetas')}
              type="number"
              min="1"
              className="w-full border border-gray-200 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {errors.cubetas && (
              <p className="text-red-500 text-xs mt-1">{errors.cubetas.message}</p>
            )}
          </div>

          <div className={`rounded-xl p-3 border text-xs flex justify-between
            ${stockInsuficiente
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-amber-50 border-amber-100 text-amber-700'
            }`}>
            <span>Huevos solicitados: {nuevosHuevos.toLocaleString()}</span>
            <span>Disponibles: {stockReal.toLocaleString()}</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              {...register('observaciones')}
              rows={2}
              className="w-full border border-gray-200 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting || stockInsuficiente}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold
                         transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}