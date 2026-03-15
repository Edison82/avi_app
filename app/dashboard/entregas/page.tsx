'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MessageCircle, Printer, Plus, Minus, ChevronLeft, ChevronRight, X } from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────
type CategoriaHuevo = 'JUMBO' | 'AAA' | 'AA' | 'A' | 'B' | 'C';

const CATEGORIAS: CategoriaHuevo[] = ['JUMBO', 'AAA', 'AA', 'A', 'B', 'C'];
const LIMITE = 4;

interface DetalleCategoria {
  categoria: CategoriaHuevo;
  cantidad:  number;
}

interface EntregaResponse {
  id:                    string;
  fecha:                 string;
  huevosEntregados:      number;
  precioVentaUnitario:   number;
  ingresoTotal:          number;
  clienteNombre?:        string | null;
  observaciones?:        string | null;
  detalleCategoriasJson: DetalleCategoria[] | unknown;
}

// ── Colores por categoría ──────────────────────────────────────
const CAT_COLOR: Record<CategoriaHuevo, { badge: string; bg: string; text: string }> = {
  JUMBO: { badge: 'bg-violet-100 text-violet-700', bg: 'bg-violet-50', text: 'text-violet-700' },
  AAA:   { badge: 'bg-amber-100  text-amber-700',  bg: 'bg-amber-50',  text: 'text-amber-700'  },
  AA:    { badge: 'bg-yellow-100 text-yellow-700', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  A:     { badge: 'bg-green-100  text-green-700',  bg: 'bg-green-50',  text: 'text-green-700'  },
  B:     { badge: 'bg-blue-100   text-blue-700',   bg: 'bg-blue-50',   text: 'text-blue-700'   },
  C:     { badge: 'bg-gray-100   text-gray-600',   bg: 'bg-gray-50',   text: 'text-gray-600'   },
};

// ── Schema ─────────────────────────────────────────────────────
const formSchema = z.object({
  precioVentaUnitario: z.coerce.number().min(0, 'Precio requerido'),
  clienteNombre:       z.string().optional(),
  observaciones:       z.string().optional(),
});
type FormInput  = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

// ── Helpers ────────────────────────────────────────────────────
const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);

const formatTime = (s: string) =>
  new Date(s).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

const formatDateShort = (s: string) =>
  new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });

// Parsear detalleCategoriasJson de forma segura
function parseDetalles(raw: unknown): DetalleCategoria[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (d): d is DetalleCategoria =>
      d && typeof d === 'object' && 'categoria' in d && 'cantidad' in d
  );
}

// ── Componente ─────────────────────────────────────────────────
export default function EntregasPage() {
  const [entregas,    setEntregas]    = useState<EntregaResponse[]>([]);
  const [total,       setTotal]       = useState(0);
  const [pagina,      setPagina]      = useState(1);
  const [alerta,      setAlerta]      = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null);
  const [reloadKey,   setReloadKey]   = useState(0);

  // Cantidades por categoría — estado independiente del form
  const [cantidades, setCantidades] = useState<Record<CategoriaHuevo, number>>({
    JUMBO: 0, AAA: 0, AA: 0, A: 0, B: 0, C: 0,
  });

  const totalPaginas = Math.ceil(total / LIMITE) || 1;

  // ── Cargar entregas ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function cargar() {
      const res  = await fetch(`/api/entregas?pagina=${pagina}&limite=${LIMITE}`);
      const json = await res.json();
      if (cancelled) return;
      if (json.success) {
        setEntregas(json.data);
        setTotal(json.pagination.total);
      }
    }
    cargar();
    return () => { cancelled = true; };
  }, [pagina, reloadKey]);

  const mostrarAlerta = (msg: string, tipo: 'ok' | 'err') => {
    setAlerta({ msg, tipo });
    setTimeout(() => setAlerta(null), 4000);
  };

  // ── Formulario ──────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver:      zodResolver(formSchema),
    defaultValues: { precioVentaUnitario: 600, clienteNombre: '', observaciones: '' },
  });

  const precioRaw = useWatch({ control, name: 'precioVentaUnitario' });
  const precio    = Number(precioRaw) || 0;

  // Detalles con cantidad > 0
  const detallesActivos = CATEGORIAS
    .filter((cat) => cantidades[cat] > 0)
    .map((cat)    => ({ categoria: cat, cantidad: cantidades[cat] }));

  const totalHuevos  = detallesActivos.reduce((s, d) => s + d.cantidad, 0);
  const totalEstimado = totalHuevos * precio;

  const ajustarCantidad = (cat: CategoriaHuevo, delta: number) => {
    setCantidades((prev) => ({
      ...prev,
      [cat]: Math.max(0, (prev[cat] || 0) + delta),
    }));
  };

  const onSubmit: SubmitHandler<FormInput> = async (rawData) => {
    if (detallesActivos.length === 0) {
      mostrarAlerta('❌ Debes añadir al menos una categoría con cantidad mayor a 0', 'err');
      return;
    }

    const parsed = formSchema.safeParse(rawData);
    if (!parsed.success) return;
    const data: FormOutput = parsed.data;

    const res  = await fetch('/api/entregas', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        ...data,
        fecha:    new Date().toISOString(),
        detalles: detallesActivos,
      }),
    });
    const json = await res.json();

    if (json.success) {
      reset({ precioVentaUnitario: 600, clienteNombre: '', observaciones: '' });
      setCantidades({ JUMBO: 0, AAA: 0, AA: 0, A: 0, B: 0, C: 0 });
      mostrarAlerta('✅ Entrega registrada exitosamente', 'ok');
      setPagina(1);
      setReloadKey((k) => k + 1);
    } else {
      mostrarAlerta(`❌ ${json.error}`, 'err');
    }
  };

  // ── Recibo WhatsApp ──────────────────────────────────────────
  const enviarWhatsapp = (e: EntregaResponse) => {
    const detalles = parseDetalles(e.detalleCategoriasJson);
    const lineasDetalle = detalles.length > 0
      ? detalles.map((d) => `  ${d.categoria}: ${d.cantidad} huevos`).join('\n')
      : `  Total: ${e.huevosEntregados} huevos`;

    const texto = [
      'RECIBO DE ENTREGA',
      '─────────────────',
      `Fecha:   ${new Date(e.fecha).toLocaleString('es-CO')}`,
      `Cliente: ${e.clienteNombre || 'General'}`,
      '',
      'Detalle:',
      lineasDetalle,
      '',
      `Precio:  ${formatCOP(Number(e.precioVentaUnitario))} / huevo`,
      `TOTAL:   ${formatCOP(Number(e.ingresoTotal))}`,
    ].join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">

      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-gray-900">🚚 Despacho de Mercancía</h1>
        <p className="text-gray-500 text-sm">Registra tus entregas especificando la cantidad por categoría</p>
      </header>

      {/* Alerta */}
      {alerta && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium border
          ${alerta.tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          <span>{alerta.msg}</span>
          <button onClick={() => setAlerta(null)}><X size={15} /></button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">

        {/* ── FORMULARIO ── */}
        <form onSubmit={handleSubmit(onSubmit)}
          className="bg-white p-6 rounded-2xl shadow-sm border space-y-5">

          <h2 className="font-bold text-gray-800">Nueva Entrega</h2>

          {/* ── Selector de categorías ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Huevos por Categoría *
            </label>
            <div className="space-y-2">
              {CATEGORIAS.map((cat) => {
                const c     = cantidades[cat];
                const style = CAT_COLOR[cat];
                return (
                  <div key={cat}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all
                      ${c > 0 ? `${style.bg} border-current` : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${style.badge}`}>
                        {cat}
                      </span>
                      {c > 0 && (
                        <span className={`text-xs font-semibold ${style.text}`}>
                          {c} huevos · {formatCOP(c * precio)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => ajustarCantidad(cat, -30)}
                        disabled={c < 30}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border
                                   hover:bg-red-50 hover:border-red-200 disabled:opacity-30 text-gray-600
                                   hover:text-red-600 transition-colors text-xs font-bold"
                        title="-30"
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={c || ''}
                        placeholder="0"
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setCantidades((prev) => ({ ...prev, [cat]: val }));
                        }}
                        className={`w-16 text-center text-sm font-bold border rounded-lg p-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400
                          ${c > 0 ? 'bg-white' : 'bg-white'}`}
                      />
                      <button
                        type="button"
                        onClick={() => ajustarCantidad(cat, 30)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border
                                   hover:bg-green-50 hover:border-green-200 text-gray-600
                                   hover:text-green-600 transition-colors"
                        title="+30"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Subtotal por categoría */}
            {detallesActivos.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl space-y-1">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">
                  Resumen de la entrega
                </p>
                {detallesActivos.map((d) => (
                  <div key={d.categoria} className="flex justify-between text-xs text-gray-700">
                    <span className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${CAT_COLOR[d.categoria].badge}`}>
                        {d.categoria}
                      </span>
                      {d.cantidad} huevos
                    </span>
                    <span className="font-semibold">{formatCOP(d.cantidad * precio)}</span>
                  </div>
                ))}
                <div className="border-t border-amber-200 pt-1.5 mt-1 flex justify-between text-sm font-bold text-amber-800">
                  <span>{totalHuevos} huevos total</span>
                  <span>{formatCOP(totalEstimado)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Precio unitario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Precio Unitario (COP) *
            </label>
            <input
              {...register('precioVentaUnitario')}
              type="number"
              min="0"
              step="1"
              className="w-full border border-gray-200 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {errors.precioVentaUnitario && (
              <p className="text-red-500 text-xs mt-1">{errors.precioVentaUnitario.message}</p>
            )}
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <input
              {...register('clienteNombre')}
              placeholder="Nombre del cliente (opcional)"
              className="w-full border border-gray-200 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              {...register('observaciones')}
              rows={2}
              placeholder="Notas opcionales..."
              className="w-full border border-gray-200 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || totalHuevos === 0}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold text-sm
                       transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? 'Procesando...'
              : totalHuevos === 0
                ? 'Añade huevos para confirmar'
                : `Confirmar Entrega — ${formatCOP(totalEstimado)}`
            }
          </button>
        </form>

        {/* ── TABLA DE ENTREGAS ── */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">Mis Entregas</h2>
            <span className="text-xs text-gray-400">{total} entrega{total !== 1 ? 's' : ''}</span>
          </div>

          <div className="flex-1 overflow-auto">
            {entregas.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">Sin entregas registradas</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left   text-xs font-medium text-gray-500">Fecha</th>
                    <th className="px-3 py-2 text-left   text-xs font-medium text-gray-500">Cliente</th>
                    <th className="px-3 py-2 text-left   text-xs font-medium text-gray-500">Detalle</th>
                    <th className="px-3 py-2 text-right  text-xs font-medium text-gray-500">Total</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {entregas.map((e) => {
                    const detalles = parseDetalles(e.detalleCategoriasJson);
                    return (
                      <tr key={e.id} className="hover:bg-gray-50 align-top">
                        <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                          <p>{formatDateShort(e.fecha)}</p>
                          <p className="text-gray-400">{formatTime(e.fecha)}</p>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 max-w-[80px] truncate">
                          {e.clienteNombre || <span className="text-gray-400 italic">S.N.</span>}
                        </td>
                        {/* Columna de detalle por categoría */}
                        <td className="px-3 py-2.5">
                          {detalles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {detalles.map((d) => (
                                <span
                                  key={d.categoria}
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CAT_COLOR[d.categoria].badge}`}
                                  title={`${d.categoria}: ${d.cantidad} huevos`}
                                >
                                  {d.categoria} ×{d.cantidad}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">
                              {e.huevosEntregados} huevos
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs font-bold text-green-700 whitespace-nowrap">
                          {formatCOP(Number(e.ingresoTotal))}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => enviarWhatsapp(e)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Enviar por WhatsApp"
                            >
                              <MessageCircle size={14} />
                            </button>
                            <button
                              onClick={() => window.print()}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Imprimir"
                            >
                              <Printer size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginación */}
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
    </div>
  );
}