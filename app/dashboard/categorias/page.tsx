'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Edit, ToggleLeft, ToggleRight, Plus, X } from 'lucide-react';

interface Categoria {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
}

export default function CategoriasPage() {
  const { data: session } = useSession();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal de crear/editar
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: ''
  });

  const isAdmin = session?.user?.rol === 'ADMIN';

  useEffect(() => {
    fetchCategorias();
  }, []);

  const fetchCategorias = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/categorias?incluirInactivas=true');
      const data = await response.json();

      if (data.success) {
        setCategorias(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al cargar categorías');
      console.error('Ocurrio un error al cargar categorias:',err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const url = editingId 
        ? `/api/categorias/${editingId}`
        : '/api/categorias';
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        setShowModal(false);
        setFormData({ nombre: '', descripcion: '' });
        setEditingId(null);
        fetchCategorias();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al guardar categoría');
      console.error('Error al guardar categorias:', err)
    }
  };

  const handleToggleActiva = async (id: string, activa: boolean) => {
    try {
      const response = await fetch(`/api/categorias/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activa: !activa })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        fetchCategorias();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al cambiar estado');
      console.log('Error al cambiar estado de la categoria: ', err);
    }
  };

  const openEditModal = (categoria: Categoria) => {
    setEditingId(categoria.id);
    setFormData({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({ nombre: '', descripcion: '' });
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Categorías de Gastos</h1>
          <p className="text-gray-600 mt-1">Gestiona las categorías para clasificar tus gastos</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} className="mr-2" />
            Nueva Categoría
          </Button>
        )}
      </div>

      {/* Alerts */}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Advertencia para no admin */}
      {!isAdmin && (
        <Alert type="info" message="Solo los administradores pueden crear o modificar categorías" />
      )}

      {/* Lista de Categorías */}
      <Card>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando categorías...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {categorias.map((categoria) => (
              <div
                key={categoria.id}
                className={`p-4 rounded-lg border ${categoria.activa ? 'bg-white' : 'bg-gray-50'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className={`font-semibold ${categoria.activa ? 'text-gray-900' : 'text-gray-500'}`}>
                        {categoria.nombre}
                      </h3>
                      {!categoria.activa && (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-600 rounded">
                          Inactiva
                        </span>
                      )}
                    </div>
                    {categoria.descripcion && (
                      <p className="text-sm text-gray-600 mt-1">{categoria.descripcion}</p>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => openEditModal(categoria)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Editar"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleToggleActiva(categoria.id, categoria.activa)}
                        className={`p-2 rounded ${categoria.activa ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                        title={categoria.activa ? 'Desactivar' : 'Activar'}
                      >
                        {categoria.activa ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {categorias.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600">No hay categorías registradas</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Modal de Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            {error && (
              <div className="mb-4">
                <Alert type="error" message={error} onClose={() => setError(null)} />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nombre"
                type="text"
                placeholder="Ej: Alimento, Medicinas..."
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="Descripción de la categoría..."
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingId ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}