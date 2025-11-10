import { z } from 'zod';

export const registroDiarioShema = z.object({
    fecha: z.date().max(new Date(), 'La fecha no puede ser futura'),
    huevosProducidos: z.number().int().min(0, 'Debe ser mayor a 0'),
    huevosVendidos: z.number().int().min(0),
    precioVenta: z.number().min(0).multipleOf(0.01),
}).refine(data => data.huevosVendidos <= data.huevosProducidos, {
    message: 'No puedes vender mas huevos de los producidos',
    path: ['huevosVendidos']
});

export type RegistroDiarioInput = z.infer<typeof registroDiarioShema>;