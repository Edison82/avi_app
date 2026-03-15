import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

// ── Utilidades ─────────────────────────────────────────────────
const aleatorio    = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const aleatorioDec = (min: number, max: number) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

type CategoriaHuevo = 'JUMBO' | 'AAA' | 'AA' | 'A' | 'B' | 'C';

// Distribución realista de categorías en una granja colombiana:
// mayoría A y AA, algo de AAA, poca JUMBO, algo B/C
const DISTRIBUCION_CATEGORIAS: CategoriaHuevo[] = [
  'A', 'A', 'A', 'A', 'A',   // 33%
  'AA', 'AA', 'AA', 'AA',    // 27%
  'AAA', 'AAA', 'AAA',       // 20%
  'JUMBO', 'JUMBO',           // 13%
  'B', 'C',                   // 7%
];

const categoriaAleatoria = (): CategoriaHuevo =>
  DISTRIBUCION_CATEGORIAS[aleatorio(0, DISTRIBUCION_CATEGORIAS.length - 1)];

function produccionDia(base: number, dia: number): number {
  const tendencia = Math.sin((dia / 35) * Math.PI) * 20;
  const ruido     = aleatorio(-15, 15);
  return Math.max(300, Math.round(base + tendencia + ruido));
}

async function main() {
  console.log('🌱 Iniciando seed de base de datos...\n');

  // ── 1. USUARIOS ───────────────────────────────────────────────
  console.log('👤 Creando usuarios...');

  const passAdmin     = await hash('admin123',     12);
  const passOperario  = await hash('operario123',  12);
  const passConductor = await hash('conductor123', 12);

  const admin = await prisma.usuario.upsert({
    where:  { email: 'admin@avicola.com' },
    update: {},
    create: { nombre: 'Carlos Administrador', email: 'admin@avicola.com', password: passAdmin, rol: 'ADMIN' },
  });

  const operario = await prisma.usuario.upsert({
    where:  { email: 'operario@avicola.com' },
    update: {},
    create: { nombre: 'Juan Operario', email: 'operario@avicola.com', password: passOperario, rol: 'OPERARIO', creadoPorId: admin.id },
  });

  const conductor = await prisma.usuario.upsert({
    where:  { email: 'conductor@avicola.com' },
    update: {},
    create: { nombre: 'Pedro Conductor', email: 'conductor@avicola.com', password: passConductor, rol: 'CONDUCTOR', creadoPorId: admin.id },
  });

  console.log('  ✅ Admin, Operario y Conductor creados');

  // ── 2. GRANJA ─────────────────────────────────────────────────
  console.log('\n🏠 Configurando granja...');

  let granja = await prisma.granja.findUnique({ where: { adminId: admin.id } });

  if (!granja) {
    granja = await prisma.granja.create({
      data: {
        nombre:      'Granja El Porvenir',
        slug:        'granja-el-porvenir',
        numeroAves:  500,
        fechaIngreso: new Date('2024-01-15'),
        adminId:     admin.id,
      },
    });
  }

  for (const usr of [operario, conductor]) {
    await prisma.usuarioGranja.upsert({
      where:  { usuarioId_granjaId: { usuarioId: usr.id, granjaId: granja.id } },
      update: {},
      create: { usuarioId: usr.id, granjaId: granja.id },
    });
  }

  console.log(`  ✅ Granja: ${granja.nombre}`);

  // ── 3. CATEGORÍAS DE GASTO ────────────────────────────────────
  console.log('\n📁 Creando categorías de gasto...');

  const categoriasGasto = [
    { nombre: 'Alimento',      descripcion: 'Concentrado y suplementos' },
    { nombre: 'Medicinas',     descripcion: 'Medicamentos, vacunas y vitaminas' },
    { nombre: 'Mano de Obra',  descripcion: 'Salarios y jornales' },
    { nombre: 'Servicios',     descripcion: 'Agua, luz y servicios' },
    { nombre: 'Mantenimiento', descripcion: 'Reparaciones e infraestructura' },
    { nombre: 'Otros',         descripcion: 'Gastos diversos' },
  ];

  const cats: Record<string, string> = {};
  for (const cat of categoriasGasto) {
    const c = await prisma.categoria.upsert({
      where:  { granjaId_nombre: { granjaId: granja.id, nombre: cat.nombre } },
      update: {},
      create: { ...cat, granjaId: granja.id },
    });
    cats[cat.nombre] = c.id;
  }

  console.log(`  ✅ ${categoriasGasto.length} categorías de gasto`);

  // ── 4. REGISTROS DIARIOS — 35 días ───────────────────────────
  console.log('\n📊 Creando registros diarios (35 días)...');

  const hoy          = new Date();
  const BASE_HUEVOS  = 430;
  const PRECIO_HUEVO = 600;
  let   avesActuales = granja.numeroAves;
  let   creadosReg   = 0;

  // Acumulador de inventario por categoría para el seed
  const inventarioAcum: Record<CategoriaHuevo, number> = {
    JUMBO: 0, AAA: 0, AA: 0, A: 0, B: 0, C: 0,
  };

  const usuariosRegistro = [admin.id, operario.id, operario.id];

  for (let i = 34; i >= 0; i--) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - i);
    fecha.setHours(0, 0, 0, 0);

    const existente = await prisma.registroDiario.findUnique({
      where: { granjaId_fecha: { granjaId: granja.id, fecha } },
    });
    if (existente) continue;

    const categoriaHuevo   = categoriaAleatoria();
    const huevosProducidos = produccionDia(BASE_HUEVOS, 34 - i);
    const huevosVendidos   = Math.floor(huevosProducidos * aleatorioDec(0.90, 0.98));
    const ingresoTotal     = huevosVendidos * PRECIO_HUEVO;

    const randMort   = Math.random();
    const mortalidad =
      randMort < 0.55 ? 0 :
      randMort < 0.80 ? 1 :
      randMort < 0.93 ? aleatorio(2, 3) :
      aleatorio(4, 7);

    avesActuales = Math.max(1, avesActuales - mortalidad);
    inventarioAcum[categoriaHuevo] += huevosProducidos;

    const gastosDia: { descripcion: string; monto: number; categoriaId: string }[] = [
      { descripcion: 'Bulto de concentrado', monto: aleatorio(78000, 92000), categoriaId: cats['Alimento'] },
    ];

    if (i % 3 === 0) {
      gastosDia.push({
        descripcion: aleatorio(0, 1) === 0 ? 'Vitaminas y electrolitos' : 'Vacuna Newcastle',
        monto:       aleatorio(12000, 28000),
        categoriaId: cats['Medicinas'],
      });
    }
    if ((34 - i) % 7 === 0) {
      gastosDia.push({ descripcion: 'Jornal semanal operario', monto: aleatorio(50000, 70000), categoriaId: cats['Mano de Obra'] });
    }
    if ((34 - i) % 15 === 0) {
      gastosDia.push({ descripcion: 'Factura agua y luz', monto: aleatorio(35000, 55000), categoriaId: cats['Servicios'] });
    }
    if (Math.random() < 0.08) {
      gastosDia.push({ descripcion: 'Reparación bebederos', monto: aleatorio(15000, 45000), categoriaId: cats['Mantenimiento'] });
    }

    const usuarioId = usuariosRegistro[aleatorio(0, usuariosRegistro.length - 1)];

    await prisma.registroDiario.create({
      data: {
        fecha,
        huevosProducidos,
        huevosVendidos,
        precioVentaUnitario: PRECIO_HUEVO,
        ingresoTotal,
        mortalidad,
        categoriaHuevo,   // ← guardado con cada registro
        observaciones: mortalidad >= 4
          ? `⚠️ Alta mortalidad: ${mortalidad} aves.`
          : mortalidad > 0
            ? `Baja registrada: ${mortalidad} ave${mortalidad > 1 ? 's' : ''}.`
            : undefined,
        granjaId:  granja.id,
        usuarioId,
        gastos: { create: gastosDia },
      },
    });

    creadosReg++;
  }

  // Actualizar granja con aves actuales
  await prisma.granja.update({ where: { id: granja.id }, data: { numeroAves: avesActuales } });
  console.log(`  ✅ ${creadosReg} registros creados (aves activas: ${avesActuales})`);

  // ── 5. INVENTARIO — poblar con la producción acumulada ────────
  console.log('\n📦 Poblando inventario de huevos...');

  for (const [cat, cantidad] of Object.entries(inventarioAcum) as [CategoriaHuevo, number][]) {
    if (cantidad === 0) continue;
    await prisma.inventarioHuevos.upsert({
      where:  { granjaId_categoriaHuevo: { granjaId: granja.id, categoriaHuevo: cat } },
      update: { cantidadHuevos: cantidad },
      create: { granjaId: granja.id, categoriaHuevo: cat, cantidadHuevos: cantidad },
    });
    const cubetas = Math.floor(cantidad / 30);
    console.log(`  • ${cat}: ${cantidad} huevos (${cubetas} cubetas)`);
  }

  // ── 6. ENTREGAS DEL CONDUCTOR ─────────────────────────────────
  console.log('\n🚚 Creando entregas del conductor...');

  const clientes = [
    'Supermercado La Colina', 'Tienda Don Pedro', 'Restaurante El Buen Sabor',
    'Distribuidora Central', 'Cliente General', 'Panadería San José',
  ];

  let entregasCreadas = 0;

  for (let i = 34; i >= 0; i--) {
    if (i % 7 === 0 || i % 7 === 6) continue; // sin entregas fin de semana

    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - i);
    fecha.setHours(0, 0, 0, 0);

    const numEntregas = aleatorio(1, 2);
    for (let e = 0; e < numEntregas; e++) {
      const huevosEntregados    = aleatorio(80, 180);
      const precioVentaUnitario = aleatorio(580, 650);
      await prisma.entregaConductor.create({
        data: {
          fecha,
          huevosEntregados,
          precioVentaUnitario,
          ingresoTotal:  huevosEntregados * precioVentaUnitario,
          clienteNombre: clientes[aleatorio(0, clientes.length - 1)],
          granjaId:      granja.id,
          conductorId:   conductor.id,
        },
      });
      entregasCreadas++;
    }
  }

  console.log(`  ✅ ${entregasCreadas} entregas creadas`);

  // ── 7. CARGAS DEL CONDUCTOR ───────────────────────────────────
  console.log('\n📤 Creando cargas del conductor...');

  const CATEGORIAS_CARGA: CategoriaHuevo[] = ['A', 'AA', 'AAA', 'A', 'B'];
  let   cargasCreadas = 0;

  for (let i = 30; i >= 0; i -= 3) { // cada 3 días hay una carga
    const cat        = CATEGORIAS_CARGA[aleatorio(0, CATEGORIAS_CARGA.length - 1)];
    const cubetas    = aleatorio(5, 20);
    const huevosEq   = cubetas * 30;
    const stockDisp  = inventarioAcum[cat];

    // Solo crear carga si hay stock suficiente
    if (stockDisp < huevosEq) continue;
    inventarioAcum[cat] -= huevosEq;

    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - i);

    await prisma.cargaConductor.create({
      data: {
        fecha,
        categoriaHuevo:    cat,
        cubetas,
        huevosEquivalentes: huevosEq,
        granjaId:           granja.id,
        conductorId:        conductor.id,
      },
    });
    cargasCreadas++;
  }

  // Actualizar inventario con las cargas descontadas
  for (const [cat, cantidad] of Object.entries(inventarioAcum) as [CategoriaHuevo, number][]) {
    await prisma.inventarioHuevos.upsert({
      where:  { granjaId_categoriaHuevo: { granjaId: granja.id, categoriaHuevo: cat } },
      update: { cantidadHuevos: Math.max(0, cantidad) },
      create: { granjaId: granja.id, categoriaHuevo: cat, cantidadHuevos: Math.max(0, cantidad) },
    });
  }

  console.log(`  ✅ ${cargasCreadas} cargas creadas`);

  // ── RESUMEN ───────────────────────────────────────────────────
  console.log('\n🎉 Seed completado exitosamente!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 Credenciales de acceso:\n');
  console.log('  👑 Admin       admin@avicola.com     / admin123');
  console.log('  🔧 Operario    operario@avicola.com  / operario123');
  console.log('  🚛 Conductor   conductor@avicola.com / conductor123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => { console.error('❌ Error en seed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
