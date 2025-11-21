import z from "zod";

// Helper para convertir strings a number en inputs
const toNumber = (val: unknown) => {
    if (typeof val === "string" && val.trim() !== "") {
      const n = Number(val);
      return Number.isNaN(n) ? undefined : n;
    }
    return typeof val === "number" ? val : undefined;
  };

//Schema de Registro de Usuario
export const registroUsuarioSchema = z.object({
    nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
    email: z.string().email('Email invalido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmarPassword: z.string()
}).refine(data => data.password === data.confirmarPassword, {
    message: 'Las contraseña no coinciden',
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

// Schema de Gasto
export const gastoSchema = z.object({
  descripcion: z.string().min(3, "La descripción debe tener al menos 3 caracteres"),
  monto: z.preprocess(toNumber, z.number().nonnegative("El monto debe ser mayor o igual a 0")),
  // Aceptamos string no vacío para categoriaId (más flexible para UUID/ObjectId)
  categoriaId: z.string().min(1, "Categoría inválida"),
});

// Schema de Registro Diario
export const registroDiarioSchema = z
  .object({
    // Fecha en formato YYYY-MM-DD (string). Validamos que no sea futura.
    fecha: z.string().refine((date) => {
        const selected = new Date(`${date}T00:00:00`);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return selected <= today;
      }, "La fecha no puede ser futura"),
    huevosProducidos: z.preprocess(toNumber, z.number().int().min(0, "Debe ser mayor o igual a 0")),
    huevosVendidos: z.preprocess(toNumber, z.number().int().min(0, "Debe ser mayor o igual a 0")),
    precioVentaUnitario: z.preprocess(toNumber, z.number().min(0, "El precio debe ser mayor o igual a 0")),
    observaciones: z.string().optional(),
    // Aseguramos default [] y transform para que el tipo final siempre tenga array
    gastos: z.array(gastoSchema).default([]),
  })
  .refine((data) => data.huevosVendidos <= data.huevosProducidos, {
    message: "No puedes vender más huevos de los producidos",
    path: ["huevosVendidos"],
  });

// Tipos TypeScript inferidos
export type RegistroUsuarioInput = z.infer<typeof registroUsuarioSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ConfiguracionGranjaInput = z.infer<typeof configuracionGranjaSchema>;
export type CategoriaInput = z.infer<typeof categoriaSchema>;
export type GastoInput = z.infer<typeof gastoSchema>;
export type RegistroDiarioInput = z.infer<typeof registroDiarioSchema>;