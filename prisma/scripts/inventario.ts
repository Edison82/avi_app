/**
 * Script de corrección — ejecutar UNA sola vez:
 *   npx ts-node prisma/scripts/fix-inventario.ts
 *
 * Problema: si el seed corrió antes de que existiera el campo categoriaHuevo
 * en RegistroDiario, todos los registros quedaron con @default(A), y por
 * tanto InventarioHuevos tiene 6 filas todas con categoriaHuevo = 'A'.
 *
 * Este script:
 *   1. Elimina todas las filas de InventarioHuevos de la granja
 *   2. Recalcula el stock real sumando huevosProducidos de cada RegistroDiario
 *      agrupado por categoriaHuevo
 *   3. Recrea las filas con los valores correctos
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Iniciando corrección de inventario de huevos...\n');

  const granjas = await prisma.granja.findMany({ select: { id: true, nombre: true } });

  for (const granja of granjas) {
    console.log(`🏠 Granja: ${granja.nombre} (${granja.id})`);

    // 1. Calcular stock real por categoría desde los registros diarios
    const registros = await prisma.registroDiario.findMany({
      where:  { granjaId: granja.id },
      select: { categoriaHuevo: true, huevosProducidos: true },
    });

    // Sumar por categoría
    const acum: Record<string, number> = {};
    for (const r of registros) {
      const cat = r.categoriaHuevo;
      acum[cat]  = (acum[cat] ?? 0) + r.huevosProducidos;
    }

    // 2. Calcular cargas descontadas por categoría
    const cargas = await prisma.cargaConductor.findMany({
      where:  { granjaId: granja.id },
      select: { categoriaHuevo: true, huevosEquivalentes: true },
    });

    for (const c of cargas) {
      const cat  = c.categoriaHuevo;
      acum[cat]  = Math.max(0, (acum[cat] ?? 0) - c.huevosEquivalentes);
    }

    console.log('  Stock calculado:', acum);

    // 3. Eliminar filas existentes y recrear
    await prisma.inventarioHuevos.deleteMany({ where: { granjaId: granja.id } });

    const categorias = ['JUMBO', 'AAA', 'AA', 'A', 'B', 'C'] as const;

    for (const cat of categorias) {
      const cantidad = acum[cat] ?? 0;
      await prisma.inventarioHuevos.create({
        data: {
          granjaId:      granja.id,
          categoriaHuevo: cat,
          cantidadHuevos: cantidad,
        },
      });
      console.log(`  ✅ ${cat}: ${cantidad} huevos (${Math.floor(cantidad / 30)} cubetas)`);
    }

    console.log('');
  }

  console.log('🎉 Corrección completada.\n');
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });