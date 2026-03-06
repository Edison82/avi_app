'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Users, UserPlus} from 'lucide-react';

const schema = z.object({
  nombre: z.string().min(3, 'Mínimo 3 caracteres'),
  identificador: z.string().min(2).regex(/^[a-z0-9]+$/, 'Solo letras minúsculas y números'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  rol: z.enum(['OPERARIO', 'CONDUCTOR']),
});
type FormData = z.infer<typeof schema>;

interface Usuario {
  id: string; nombre: string; email: string; rol: string; activo: boolean; createdAt: string;
}

export default function ConfiguracionPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<{ email: string; password: string } | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rol: 'OPERARIO' }
  });

  const cargarUsuarios = async () => {
    const res = await fetch('/api/configuracion/usuarios');
    const json = await res.json();
    if (json.success) setUsuarios(json.data);
  };

  useEffect(() => { cargarUsuarios(); }, []);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError(null);
    setExito(null);
    try {
      const res = await fetch('/api/configuracion/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error); return; }
      setExito(json.data.credenciales);
      reset();
      cargarUsuarios();
    } catch { setError('Error al crear usuario'); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>

      {/* Crear usuario */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-6">
          <UserPlus className="text-amber-500" size={24} />
          <h2 className="text-lg font-semibold text-gray-800">Crear Cuenta</h2>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

        {exito && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium text-sm mb-2">✅ Cuenta creada. Comparte estas credenciales:</p>
            <p className="text-sm text-gray-700">Email: <span className="font-mono font-semibold">{exito.email}</span></p>
            <p className="text-sm text-gray-700">Contraseña: <span className="font-mono font-semibold">{exito.password}</span></p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
            <input {...register('nombre')} placeholder="Juan Pérez"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Identificador</label>
            <input {...register('identificador')} placeholder="juan01"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <p className="text-xs text-gray-400 mt-1">Solo letras minúsculas y números</p>
            {errors.identificador && <p className="text-red-500 text-xs mt-1">{errors.identificador.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input {...register('password')} type="password" placeholder="••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de cuenta</label>
            <select {...register('rol')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500">
              <option value="OPERARIO">🐓 Operario de Granja</option>
              <option value="CONDUCTOR">🚚 Conductor / Repartidor</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button type="submit" disabled={isLoading}
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50">
              {isLoading ? 'Creando...' : 'Crear cuenta'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de usuarios */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Users className="text-amber-500" size={24} />
          <h2 className="text-lg font-semibold text-gray-800">Usuarios de la Granja</h2>
        </div>

        {usuarios.length === 0 ? (
          <p className="text-gray-500 text-sm">Aún no has creado cuentas para tu granja.</p>
        ) : (
          <div className="space-y-3">
            {usuarios.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{u.nombre}</p>
                  <p className="text-xs text-gray-500 font-mono">{u.email}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  u.rol === 'OPERARIO' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {u.rol === 'OPERARIO' ? '🐓 Operario' : '🚚 Conductor'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}