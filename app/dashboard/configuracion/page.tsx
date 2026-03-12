"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Users, UserPlus, Trash2, Search } from "lucide-react";

const schema = z.object({
  nombre: z.string().min(3, "Mínimo 3 caracteres"),
  identificador: z
    .string()
    .min(2)
    .regex(/^[a-z0-9]+$/, "Solo letras minúsculas y números"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  rol: z.enum(["OPERARIO", "CONDUCTOR"]),
});
type FormData = z.infer<typeof schema>;

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  createdAt: string;
}

export default function ConfiguracionPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<Usuario | null>(
    null
  );
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);

  const usuariosPorPagina = 5;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rol: "OPERARIO" },
  });

  const cargarUsuarios = async () => {
    const res = await fetch("/api/configuracion/usuarios");
    const json = await res.json();
    if (json.success) setUsuarios(json.data);
  };

  const usuariosFiltrados = usuarios.filter(
    (u) =>
      u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      u.email.toLowerCase().includes(busqueda.toLowerCase())
  );

  const inicio = (pagina - 1) * usuariosPorPagina;
  const fin = inicio + usuariosPorPagina;

  const usuariosPaginados = usuariosFiltrados.slice(inicio, fin);
  const totalPaginas = Math.ceil(usuariosFiltrados.length / usuariosPorPagina);

  const confirmarEliminar = async () => {
    if (!usuarioAEliminar) return;

    try {
      const res = await fetch(
        `/api/configuracion/usuarios/${usuarioAEliminar.id}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      if (!json.success) {
        setError(json.error);
        return;
      }

      setUsuarioAEliminar(null);
      cargarUsuarios();
    } catch {
      setError("Error al eliminar usuario");
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError(null);
    setExito(null);
    try {
      const res = await fetch("/api/configuracion/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error);
        return;
      }
      setExito(json.data.credenciales);
      reset();
      cargarUsuarios();
    } catch {
      setError("Error al crear usuario");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>

      {usuarioAEliminar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Eliminar usuario
            </h3>

            <p className="text-sm text-gray-600 mb-6">
              ¿Seguro que quieres eliminar a{" "}
              <span className="font-semibold">{usuarioAEliminar.nombre}</span>?
              Esta acción no se puede deshacer.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setUsuarioAEliminar(null)}
                className="px-4 py-2 text-sm rounded-lg border text-black border-gray-300 hover:bg-gray-300"
              >
                Cancelar
              </button>

              <button
                onClick={confirmarEliminar}
                className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crear usuario */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-6">
          <UserPlus className="text-amber-500" size={24} />
          <h2 className="text-lg font-semibold text-gray-800">Crear Cuenta</h2>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {exito && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium text-sm mb-2">
              ✅ Cuenta creada. Comparte estas credenciales:
            </p>
            <p className="text-sm text-gray-700">
              Email:{" "}
              <span className="font-mono font-semibold">{exito.email}</span>
            </p>
            <p className="text-sm text-gray-700">
              Contraseña:{" "}
              <span className="font-mono font-semibold">{exito.password}</span>
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              {...register("nombre")}
              placeholder="Juan Pérez"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {errors.nombre && (
              <p className="text-red-500 text-xs mt-1">
                {errors.nombre.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Identificador
            </label>
            <input
              {...register("identificador")}
              placeholder="juan01"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Solo letras minúsculas y números
            </p>
            {errors.identificador && (
              <p className="text-red-500 text-xs mt-1">
                {errors.identificador.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              {...register("password")}
              type="password"
              placeholder="••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de cuenta
            </label>
            <select
              {...register("rol")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="OPERARIO">🐓 Operario de Granja</option>
              <option value="CONDUCTOR">🚚 Conductor / Repartidor</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isLoading}
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? "Creando..." : "Crear cuenta"}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de usuarios */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Users className="text-amber-500" size={24} />
          <h2 className="text-lg font-semibold text-gray-800">
            Usuarios de la Granja
          </h2>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Search size={18} className="text-gray-400" />
          <input
            placeholder="Buscar usuario..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-600">
                <th className="p-3">Usuario</th>
                <th className="p-3">Rol</th>
                <th className="p-3">Creado</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {usuariosPaginados.map((u) => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center font-semibold">
                      {u.nombre.charAt(0)}
                    </div>

                    <div>
                      <p className="font-medium text-black ">{u.nombre}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </td>

                  <td className="p-3">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        u.rol === "OPERARIO"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {u.rol}
                    </span>
                  </td>

                  <td className="p-3 text-gray-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>

                  <td className="p-3">
                    <button
                      style={{ cursor: "pointer" }}
                      onClick={async () => {
                        await fetch(
                          `/api/configuracion/usuarios/${u.id}/estado`,
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ activo: !u.activo }),
                          }
                        );

                        cargarUsuarios();
                      }}
                      className={`px-3 py-1 text-xs rounded-full ${
                        u.activo
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {u.activo ? "Activo" : "Inactivo"}
                    </button>
                  </td>

                  <td className="p-3 text-right">
                    <button
                      style={{ cursor: "pointer" }}
                      onClick={() => setUsuarioAEliminar(u)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between items-center mt-4 text-sm">
            <button
              disabled={pagina === 1}
              onClick={() => setPagina(pagina - 1)}
              className="px-3 py-1 border rounded disabled:opacity-100 text-black"
            >
              Anterior
            </button>

            <p className="text-black">
              Página {pagina} de {totalPaginas}
            </p>

            <button
              disabled={pagina === totalPaginas}
              onClick={() => setPagina(pagina + 1)}
              className="px-3 py-1 border rounded disabled:opacity-100 text-black"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
