/**
 * Lo que hace este script:
 *   1. Lee todos los RegistroDiario agrupando huevosProducidos por categoriaHuevo real
 *   2. Descuenta las CargaConductor ya registradas
 *   3. Elimina las filas actuales de InventarioHuevos y las recrea correctamente
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CATEGORIAS = ['JUMBO', 'AAA', 'AA', 'A', 'B', 'C'] as const;
type Cat = typeof CATEGORIAS[number];

async function main() {
  console.log('🔧 Corrección de inventario de huevos...\n');

  const granjas = await prisma.granja.findMany({
    select: { id: true, nombre: true },
  });

  for (const granja of granjas) {
    console.log(`🏠 ${granja.nombre}`);

    // Sumar producción por categoría
    const registros = await prisma.registroDiario.findMany({
      where:  { granjaId: granja.id },
      select: { categoriaHuevo: true, huevosProducidos: true },
    });

    const produccion: Record<string, number> = {};
    for (const r of registros) {
      const cat = r.categoriaHuevo as string;
      produccion[cat] = (produccion[cat] ?? 0) + r.huevosProducidos;
    }

    // Descontar cargas
    const cargas = await prisma.cargaConductor.findMany({
      where:  { granjaId: granja.id },
      select: { categoriaHuevo: true, huevosEquivalentes: true },
    });

    for (const c of cargas) {
      const cat = c.categoriaHuevo as string;
      produccion[cat] = Math.max(0, (produccion[cat] ?? 0) - c.huevosEquivalentes);
    }

    // Eliminar filas actuales y recrear
    await prisma.inventarioHuevos.deleteMany({ where: { granjaId: granja.id } });

    for (const cat of CATEGORIAS) {
      const cantidad = produccion[cat] ?? 0;
      await prisma.inventarioHuevos.create({
        data: {
          granjaId:       granja.id,
          categoriaHuevo: cat,
          cantidadHuevos: cantidad,
        },
      });
      const cubetas = Math.floor(cantidad / 30);
      console.log(`  ${cat}: ${cantidad} huevos → ${cubetas} cubetas`);
    }
    console.log('');
  }

  console.log('✅ Corrección completada.');
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });