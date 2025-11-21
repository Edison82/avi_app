'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { configuracionGranjaSchema, ConfiguracionGranjaInput } from '@/lib/validations/schemas';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { User, Building2 } from 'lucide-react';

export default function ConfiguracionPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasConfig, setHasConfig] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ConfiguracionGranjaInput>({
    resolver: zodResolver(configuracionGranjaSchema)
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/configuracion');
        const data = await response.json();
  
        if (data.success && data.data) {
          setHasConfig(true);
          reset({
            nombreGranja: data.data.nombreGranja,
            numeroGallinas: data.data.numeroGallinas
          });
        }
      } catch (err) {
        console.error('Error al cargar configuración:', err);
      } finally {
        setLoading(false);
      }
    };
  
    fetchData();
  }, [reset]);

  const onSubmit = async (data: ConfiguracionGranjaInput) => {
    setSaving(true);
    setError(null);

    try {
      const method = hasConfig ? 'PUT' : 'POST';
      const response = await fetch('/api/configuracion', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(result.message);
        setHasConfig(true);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Error al guardar configuración');
      console.log('Error al guardar configuracion: ', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-600 mt-1">Gestiona tu perfil y configuración de la granja</p>
      </div>

      {/* Alerts */}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Información del Usuario */}
      <Card title="Información de Usuario" className="flex items-start space-x-4">
        <div className="bg-primary-100 p-4 rounded-full">
          <User size={32} className="text-primary-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{session?.user?.name}</h3>
          <p className="text-sm text-gray-600">{session?.user?.email}</p>
          <span className="inline-block mt-2 px-3 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
            {session?.user?.rol}
          </span>
        </div>
      </Card>

      {/* Configuración de Granja */}
      <Card>
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-green-100 p-3 rounded-full">
            <Building2 size={24} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Configuración de Granja</h2>
            <p className="text-sm text-gray-600">Datos básicos de tu operación avícola</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Input
            label="Nombre de la Granja"
            type="text"
            placeholder="Ej: Granja Los Huevos de Oro"
            error={errors.nombreGranja?.message}
            {...register('nombreGranja')}
          />

          <Input
            label="Número de Gallinas"
            type="number"
            placeholder="500"
            helperText="Cantidad total de gallinas ponedoras en tu granja"
            error={errors.numeroGallinas?.message}
            {...register('numeroGallinas', { valueAsNumber: true })}
          />

          <div className="flex justify-end">
            <Button type="submit" isLoading={saving}>
              {hasConfig ? 'Actualizar Configuración' : 'Guardar Configuración'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Información Adicional */}
      <Card title="Información del Sistema">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Versión:</span>
            <span className="font-medium text-gray-900">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Último acceso:</span>
            <span className="font-medium text-gray-900">
              {new Date().toLocaleDateString('es-CO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Estado del sistema:</span>
            <span className="inline-flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              <span className="font-medium text-green-600">Operativo</span>
            </span>
          </div>
        </div>
      </Card>

      {/* Ayuda */}
      <Card>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">💡 ¿Necesitas ayuda?</h3>
          <p className="text-sm text-blue-800">
            Si tienes dudas sobre el uso del sistema o necesitas asistencia técnica, 
            contacta al administrador del sistema.
          </p>
        </div>
      </Card>
    </div>
  );
}