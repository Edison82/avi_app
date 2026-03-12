"use client";

import { useEffect, useCallback, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

/* ---------------- SCHEMA ---------------- */

const entregaSchema = z.object({
  huevosEntregados: z.coerce.number().int().min(1, "Mínimo 1"),
  precioVentaUnitario: z.coerce.number().min(0, "Debe ser positivo"),
  clienteNombre: z.string().optional(),
  observaciones: z.string().optional(),
});

type EntregaForm = z.input<typeof entregaSchema>;
type EntregaData = z.output<typeof entregaSchema>;

interface EntregaResponse {
  id: string;
  fecha: string;
  huevosEntregados: number;
  precioVentaUnitario: number;
  ingresoTotal: number;
  clienteNombre?: string | null;
}

/* ---------------- COMPONENT ---------------- */

export default function EntregasPage() {
  const [entregas, setEntregas] = useState<EntregaResponse[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EntregaForm>({
    resolver: zodResolver(entregaSchema),
  });

  /* ---------------- WATCH OPTIMIZADO ---------------- */

  const huevos = useWatch({
    control,
    name: "huevosEntregados",
  }) as number;
  
  const precio = useWatch({
    control,
    name: "precioVentaUnitario",
  }) as number;
  
  const totalEstimado = useMemo(
    () => (huevos ?? 0) * (precio ?? 0),
    [huevos, precio]
  );

  /* ---------------- API ---------------- */

  const cargarEntregas = useCallback(async () => {
    const res = await fetch("/api/entregas");
    const json = await res.json();
    if (json.success) setEntregas(json.data);
  }, []);

  useEffect(() => {
    EntregasPage();
  }, [cargarEntregas]);

  /* ---------------- SUBMIT ---------------- */

  const onSubmit: handleSubmit<EntregaForm> = async (data) => {
    try {
      await fetch("/api/entregas", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          fecha: new Date().toISOString(),
        }),
      });
  
      reset();
      cargarEntregas();
    } catch {
      setMensaje("❌ Error al guardar");
    }
  };

  /* ---------------- RECIBO ---------------- */

  const generarRecibo = (entrega: EntregaResponse) => {
    return `
RECIBO DE ENTREGA
-------------------------
Fecha: ${new Date(entrega.fecha).toLocaleString()}
Cliente: ${entrega.clienteNombre || "General"}
Cantidad: ${entrega.huevosEntregados}
Precio: $${entrega.precioVentaUnitario}
TOTAL: $${entrega.ingresoTotal}
`;
  };

  const enviarWhatsapp = (entrega: EntregaResponse) => {
    const url = `https://wa.me/?text=${encodeURIComponent(
      generarRecibo(entrega)
    )}`;
    window.open(url, "_blank");
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">

      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          🚚 Despacho de Mercancía
        </h1>
        <p className="text-gray-500">
          Registra tus entregas en tiempo real
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">

        {/* FORMULARIO */}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white p-6 rounded-xl shadow-sm border space-y-4"
        >

          {mensaje && (
            <div className="bg-green-50 text-green-700 p-3 rounded">
              {mensaje}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-900">
              Cantidad de Huevos
            </label>

            <input
              {...register("huevosEntregados")}
              type="number"
              className="w-full border p-2 rounded-lg"
            />

            {errors.huevosEntregados && (
              <p className="text-red-500 text-xs">
                {errors.huevosEntregados.message}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-900">
              Precio Unitario
            </label>

            <input
              {...register("precioVentaUnitario")}
              type="number"
              step="0.01"
              className="w-full border p-2 rounded-lg"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-900">
              Cliente
            </label>

            <input
              {...register("clienteNombre")}
              className="w-full border p-2 rounded-lg"
            />
          </div>

          <div className="bg-gray-50 p-3 rounded flex justify-between">
            <span className="text-gray-900 bg-green-300 rounded-md m-px px-px">Subtotal:</span>
            <span className="font-bold text-blue-600">
              ${totalEstimado.toLocaleString()}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold"
          >
            {isSubmitting ? "Procesando..." : "Confirmar Entrega"}
          </button>
        </form>

        {/* TABLA */}

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">

          <table className="w-full text-sm">

            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3">Hora</th>
                <th>Cliente</th>
                <th className="text-right">Cant.</th>
                <th></th>
              </tr>
            </thead>

            <tbody className="divide-y">

              {entregas.map((entrega) => (
                <tr key={entrega.id}>

                  <td className="px-4 py-3">
                    {new Date(entrega.fecha).toLocaleTimeString()}
                  </td>

                  <td>{entrega.clienteNombre || "S.N"}</td>

                  <td className="text-right font-semibold">
                    {entrega.huevosEntregados}
                  </td>

                  <td className="space-x-2 text-center">

                    <button
                      onClick={() => enviarWhatsapp(entrega)}
                      className="text-green-600"
                    >
                      💬
                    </button>

                    <button
                      onClick={() => window.print()}
                      className="text-blue-600"
                    >
                      🖨️
                    </button>

                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}