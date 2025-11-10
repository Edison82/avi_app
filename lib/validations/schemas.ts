import z from "zod";

//Schema de Registro de Usuario
export const registroUsuarioSchema = z.object({
    nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
    email: z.string().email('Email invalido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmarPassword: z.string()
}).refine(data => data.password === data.confirmarPassword, {
    message: 'Las contraseñan no coinciden',
    path: ['confirmarPassword']
});

// Schema de Login
export const loginSchema = z.object({
    email: z.string().email('Email invalido'),
    password: z.string().min(1, 'La contraseña es requerida')
});

// Schema de Configuracion de Granja
export const configuracionGranjaSchema = z.object({
    nombreGranja:z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
    numeroGallinas: z.number().int().min(1, 'Debe tener al menos una Gallina')
});

// Schema de Categoria
export const categoriaSchema = z.object({
    nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
    descripcion: z.string().optional()
});

// Shema de Gasto
export const gastoSchema = z.object({
    descripcion: z.string().min(3, 'La descripcion debe tener al menos 3 caracteres'),
    monto: z.number().positive('El monto debe ser mayor a 0'),
    categoriaId: z.string().uuid('Categoria Invalida')
});

// Schema de Registro Diario
export const registroDiarioSchema = z.object({
    fecha: z.string().refine(date => {
        const selectedDate = new Date(date);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return selectedDate <= today;
    }, 'La fecha no puede ser futura'),
    huevosProducidos: z.number().int().min(0, 'Debe ser mayor o igual a 0'),
    huevosVendidos: z.number().int().min(0, 'Debe ser mayor o igual a 0'),
    precioVentaUnitario: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
    observaciones: z.string().optional(),
    gastos: z.array(gastoSchema).default([])
}).refine(data => data.huevosVendidos <= data.huevosProducidos, {
    message: 'No puedes vender mas huevos de los producidos',
    path: ['huevosVendidos']
});

// Tipos TypeScript inferidos
export type RegistroUsuarioInput = z.infer<typeof registroUsuarioSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ConfiguracionGranjaInput = z.infer<typeof configuracionGranjaSchema>;
export type CategoriaInput = z.infer<typeof categoriaSchema>;
export type GastoInput = z.infer<typeof gastoSchema>;
export type registroDiarioInput = z.infer<typeof registroDiarioSchema>;