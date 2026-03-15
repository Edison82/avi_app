import { z } from 'zod';

// ── Enum compartido ───────────────────────────────────────────
export const categoriaHuevoEnum = z.enum(['JUMBO', 'AAA', 'AA', 'A', 'B', 'C']);

// lógicas de validación de fecha 
const fechaNoFutura = (date: string) => {
  const selected = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return selected <= today;
};

// ── Auth Schemas (Sin cambios) ────────────────────────────────
export const registroUsuarioSchema = z
  .object({
    nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmarPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmarPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmarPassword'],
  });

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

// ── Categoria & Gasto ─────────────────────────────────────────
export const categoriaSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion: z.string().optional(),
});

// ── Gasto individual ──────────────────────────────────────────
export const gastoSchema = z.object({
  descripcion: z.string().min(1, 'La descripción es requerida'),
  monto:       z.coerce.number().min(0, 'El monto debe ser positivo'),
  categoriaId: z.string().uuid('ID de categoría inválido'),
});


// ── Registro Diario (CON MORTALIDAD) ──────────────────────────
export const registroDiarioSchema = z
  .object({
    fecha: z.string().refine(fechaNoFutura, 'La fecha no puede ser futura'),
    // Coerce maneja la conversión de string (del input) a number automáticamente
    huevosProducidos: z.coerce
      .number()
      .int('Debe ser un número entero')
      .min(0, 'Debe ser mayor o igual a 0'),
      
    huevosVendidos: z.coerce
      .number()
      .int('Debe ser un número entero')
      .min(0, 'Debe ser mayor o igual a 0'),
      
    precioVentaUnitario: z.coerce
      .number()
      .min(0, 'El precio debe ser mayor o igual a 0'),
      
    mortalidad: z.coerce
      .number()
      .int('Debe ser un número entero')
      .min(0, 'No puede ser negativo')
      .default(0),

    observaciones: z.string().optional(),
    categoriaHuevo: categoriaHuevoEnum.default('A'),
    gastos: z.array(gastoSchema).default([]),
  })
  .refine((data) => data.huevosVendidos <= data.huevosProducidos, {
    message: 'No puedes vender más huevos de los producidos',
    path: ['huevosVendidos'],
  });

// ── Granja & Configuración ────────────────────────────────────
export const granjaSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  numeroAves: z.coerce.number().int().min(1, 'Debe tener al menos una Ave'),
  fechaIngreso: z.string().refine(fechaNoFutura, 'La fecha no puede ser futura'),
  ubicacion: z.string().optional(),
});

export const configuracionGranjaSchema = z.object({
  nombreGranja: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  numeroGallinas: z.coerce.number().int().min(1, 'Debe tener al menos una Ave'),
});

// ── Tipos TypeScript inferidos ────────────────────────────────
export type RegistroUsuarioInput = z.infer<typeof registroUsuarioSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ConfiguracionGranjaInput = z.infer<typeof configuracionGranjaSchema>;
export type CategoriaInput = z.infer<typeof categoriaSchema>;
export type GastoInput = z.infer<typeof gastoSchema>;
export type RegistroDiarioInput = z.infer<typeof registroDiarioSchema>;
export type GranjaInput = z.infer<typeof granjaSchema>;
export type CategoriaHuevoEnum = z.infer<typeof categoriaHuevoEnum>;