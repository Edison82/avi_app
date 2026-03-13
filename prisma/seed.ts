import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

// ── Utilidades ─────────────────────────────────────────────────
const aleatorio = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const aleatorioDec = (min: number, max: number) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(2));

// Simula variación realista de producción con tendencia y ruido
function produccionDia(base: number, dia: number): number {
  const tendencia  = Math.sin((dia / 35) * Math.PI) * 20; // curva suave
  const ruido      = aleatorio(-15, 15);
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
    create: {
      nombre:   'Carlos Administrador',
      email:    'admin@avicola.com',
      password: passAdmin,
      rol:      'ADMIN',
    },
  });
  console.log('  ✅ Admin:', admin.email);

  const operario = await prisma.usuario.upsert({
    where:  { email: 'operario@avicola.com' },
    update: {},
    create: {
      nombre:     'Juan Operario',
      email:      'operario@avicola.com',
      password:   passOperario,
      rol:        'OPERARIO',
      creadoPorId: admin.id,
    },
  });
  console.log('  ✅ Operario:', operario.email);

  const conductor = await prisma.usuario.upsert({
    where:  { email: 'conductor@avicola.com' },
    update: {},
    create: {
      nombre:     'Pedro Conductor',
      email:      'conductor@avicola.com',
      password:   passConductor,
      rol:        'CONDUCTOR',
      creadoPorId: admin.id,
    },
  });
  console.log('  ✅ Conductor:', conductor.email);

  // ── 2. GRANJA ────────────────────────────────────────────────
  console.log('\n🏠 Configurando granja...');

  let granja = await prisma.granja.findUnique({
    where: { adminId: admin.id },
  });

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
  console.log('  ✅ Granja:', granja.nombre, `(${granja.numeroAves} aves)`);

  // Asignar operario y conductor a la granja
  for (const usr of [operario, conductor]) {
    await prisma.usuarioGranja.upsert({
      where:  { usuarioId_granjaId: { usuarioId: usr.id, granjaId: granja.id } },
      update: {},
      create: { usuarioId: usr.id, granjaId: granja.id },
    });
  }

  // ── 3. CATEGORÍAS ────────────────────────────────────────────
  console.log('\n📁 Creando categorías...');

  const categoriasData = [
    { nombre: 'Alimento',      descripcion: 'Concentrado y suplementos alimenticios' },
    { nombre: 'Medicinas',     descripcion: 'Medicamentos, vacunas y vitaminas' },
    { nombre: 'Mano de Obra',  descripcion: 'Salarios y jornales' },
    { nombre: 'Servicios',     descripcion: 'Agua, luz, gas y servicios públicos' },
    { nombre: 'Mantenimiento', descripcion: 'Reparaciones e infraestructura' },
    { nombre: 'Otros',         descripcion: 'Gastos diversos no clasificados' },
  ];

  const cats: Record<string, string> = {};
  for (const cat of categoriasData) {
    const c = await prisma.categoria.upsert({
      where:  { granjaId_nombre: { granjaId: granja.id, nombre: cat.nombre } },
      update: {},
      create: { ...cat, granjaId: granja.id },
    });
    cats[cat.nombre] = c.id;
  }
  console.log(`  ✅ ${categoriasData.length} categorías listas`);

  // ── 4. REGISTROS DIARIOS — 35 días ───────────────────────────
  console.log('\n📊 Creando registros diarios (35 días)...');

  const hoy          = new Date();
  const BASE_HUEVOS  = 430;
  const PRECIO_HUEVO = 600; // COP por unidad
  let   avesActuales = granja.numeroAves;
  let   creados      = 0;

  // Usuarios alternantes para simular operario y admin registrando
  const usuariosRegistro = [admin.id, operario.id, operario.id]; // operario registra más

  for (let i = 34; i >= 0; i--) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - i);
    fecha.setHours(0, 0, 0, 0);

    // Evita duplicados si el seed ya corrió antes
    const existente = await prisma.registroDiario.findUnique({
      where: { granjaId_fecha: { granjaId: granja.id, fecha } },
    });
    if (existente) continue;

    // Producción con variación natural
    const huevosProducidos = produccionDia(BASE_HUEVOS, 34 - i);
    const huevosVendidos   = Math.floor(huevosProducidos * aleatorioDec(0.90, 0.98));
    const ingresoTotal     = huevosVendidos * PRECIO_HUEVO;

    // Mortalidad: 0 la mayoría de días, ocasionalmente 1-3, raramente más
    const randMort = Math.random();
    const mortalidad =
      randMort < 0.55 ? 0 :           // 55% días sin muertes
      randMort < 0.80 ? 1 :           // 25% con 1 ave
      randMort < 0.93 ? aleatorio(2, 3) : // 13% con 2-3 aves
      aleatorio(4, 7);                // 7% evento alto (enfermedad, calor)

    avesActuales = Math.max(1, avesActuales - mortalidad);

    // Gastos variables según el día
    const gastosDia: {
      descripcion: string;
      monto: number;
      categoriaId: string;
    }[] = [
      {
        descripcion: 'Bulto de concentrado ponedoras',
        monto:       aleatorio(78000, 92000),
        categoriaId: cats['Alimento'],
      },
    ];

    // Medicinas 2 veces por semana aproximadamente
    if (i % 3 === 0) {
      gastosDia.push({
        descripcion: aleatorio(0, 1) === 0 ? 'Vitaminas y electrolitos' : 'Vacuna Newcastle',
        monto:       aleatorio(12000, 28000),
        categoriaId: cats['Medicinas'],
      });
    }

    // Mano de obra los lunes (cada 7 días desde el día 34)
    if ((34 - i) % 7 === 0) {
      gastosDia.push({
        descripcion: 'Jornal semanal operario',
        monto:       aleatorio(50000, 70000),
        categoriaId: cats['Mano de Obra'],
      });
    }

    // Servicios quincenales
    if ((34 - i) % 15 === 0) {
      gastosDia.push({
        descripcion: 'Factura de agua y luz',
        monto:       aleatorio(35000, 55000),
        categoriaId: cats['Servicios'],
      });
    }

    // Mantenimiento ocasional
    if (Math.random() < 0.08) {
      gastosDia.push({
        descripcion: 'Reparación bebederos / comederos',
        monto:       aleatorio(15000, 45000),
        categoriaId: cats['Mantenimiento'],
      });
    }

    // Usuario que registra ese día (rotación realista)
    const usuarioId = usuariosRegistro[aleatorio(0, usuariosRegistro.length - 1)];

    await prisma.registroDiario.create({
      data: {
        fecha,
        huevosProducidos,
        huevosVendidos,
        precioVentaUnitario: PRECIO_HUEVO,
        ingresoTotal,
        mortalidad,
        observaciones: mortalidad >= 4
          ? `⚠️ Alta mortalidad: ${mortalidad} aves. Revisar condiciones del galpón.`
          : mortalidad > 0
            ? `Baja registrada: ${mortalidad} ave${mortalidad > 1 ? 's' : ''}.`
            : undefined,
        granjaId:  granja.id,
        usuarioId,
        gastos: { create: gastosDia },
      },
    });

    creados++;
  }

  // Actualizar numeroAves de la granja con las bajas acumuladas
  await prisma.granja.update({
    where: { id: granja.id },
    data:  { numeroAves: avesActuales },
  });

  console.log(`  ✅ ${creados} registros creados`);
  console.log(`  📉 Aves activas al final: ${avesActuales} (bajas acumuladas del seed)`);

  // ── 5. ENTREGAS DEL CONDUCTOR — 35 días ──────────────────────
  console.log('\n🚚 Creando entregas del conductor (35 días)...');

  const clientes = [
    'Supermercado La Colina',
    'Tienda Don Pedro',
    'Restaurante El Buen Sabor',
    'Distribuidora Central',
    'Cliente General',
    'Panadería San José',
  ];

  let entregasCreadas = 0;

  for (let i = 34; i >= 0; i--) {
    // El conductor no entrega todos los días (5 días a la semana)
    if (i % 7 === 0 || i % 7 === 6) continue; // sin entrega sábado/domingo

    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - i);
    fecha.setHours(0, 0, 0, 0);

    // 1-2 entregas por día
    const numEntregas = aleatorio(1, 2);

    for (let e = 0; e < numEntregas; e++) {
      const huevosEntregados    = aleatorio(80, 180);
      const precioVentaUnitario = aleatorio(580, 650); // precio puede variar por cliente
      const ingresoTotal        = huevosEntregados * precioVentaUnitario;
      const clienteNombre       = clientes[aleatorio(0, clientes.length - 1)];

      await prisma.entregaConductor.create({
        data: {
          fecha,
          huevosEntregados,
          precioVentaUnitario,
          ingresoTotal,
          clienteNombre,
          observaciones: e === 0 && Math.random() < 0.2 ? 'Entrega con factura' : undefined,
          granjaId:   granja.id,
          conductorId: conductor.id,
        },
      });
      entregasCreadas++;
    }
  }

  console.log(`  ✅ ${entregasCreadas} entregas del conductor creadas`);

  // ── RESUMEN FINAL ─────────────────────────────────────────────
  console.log('\n🎉 Seed completado exitosamente!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 Credenciales de acceso:');
  console.log('');
  console.log('  👑 Admin');
  console.log('     Email:    admin@avicola.com');
  console.log('     Password: admin123');
  console.log('');
  console.log('  🔧 Operario');
  console.log('     Email:    operario@avicola.com');
  console.log('     Password: operario123');
  console.log('');
  console.log('  🚛 Conductor');
  console.log('     Email:    conductor@avicola.com');
  console.log('     Password: conductor123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
