import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // 1. Crear usuario administrador de prueba
  console.log('👤 Creando usuario administrador de prueba...');

  const passwordHash = await hash('admin123', 12);

  const adminUser = await prisma.usuario.upsert({
    where: { email: 'admin@avicola.com' },
    update: {},
    create: {
      nombre: 'Administrador',
      email: 'admin@avicola.com',
      password: passwordHash,
      rol: 'ADMIN',
    },
  });

  console.log('✅ Usuario admin creado:', adminUser.email);

  // 2. Crear granja para el admin
  console.log('🏠 Creando granja de ejemplo...');

  let granja = await prisma.granja.findUnique({
    where: { adminId: adminUser.id },
  });

  if (!granja) {
    granja = await prisma.granja.create({
      data: {
        nombre: 'Granja Demo',
        slug: 'granja-demo',
        numeroAves: 500,
        fechaIngreso: new Date('2024-01-15'),
        adminId: adminUser.id,
      },
    });
  }

  console.log('✅ Granja creada:', granja.nombre);

  // 3. Crear categorías predeterminadas (con granjaId)
  console.log('📁 Creando categorías...');

  const categoriasData = [
    {
      nombre: 'Alimento',
      descripcion: 'Alimento concentrado para gallinas ponedoras',
    },
    {
      nombre: 'Medicinas',
      descripcion: 'Medicamentos, vacunas y suplementos veterinarios',
    },
    {
      nombre: 'Mano de Obra',
      descripcion: 'Salarios y pagos a empleados',
    },
    {
      nombre: 'Servicios',
      descripcion: 'Agua, luz, gas y otros servicios',
    },
    {
      nombre: 'Mantenimiento',
      descripcion: 'Reparaciones de infraestructura y equipo',
    },
    {
      nombre: 'Otros',
      descripcion: 'Gastos diversos no clasificados',
    },
  ];

  for (const cat of categoriasData) {
    await prisma.categoria.upsert({
      where: {
        granjaId_nombre: {
          granjaId: granja.id,
          nombre: cat.nombre,
        },
      },
      update: {},
      create: {
        nombre: cat.nombre,
        descripcion: cat.descripcion,
        granjaId: granja.id,
      },
    });
  }

  console.log(`✅ ${categoriasData.length} categorías creadas`);

  // 4. Crear usuario operario de prueba
  console.log('👤 Creando usuario operario de prueba...');

  const passwordHashOperario = await hash('operario123', 12);

  const operarioUser = await prisma.usuario.upsert({
    where: { email: 'operario@avicola.com' },
    update: {},
    create: {
      nombre: 'Juan Operario',
      email: 'operario@avicola.com',
      password: passwordHashOperario,
      rol: 'OPERARIO',
      creadoPorId: adminUser.id,
    },
  });

  // Asignar operario a la granja
  await prisma.usuarioGranja.upsert({
    where: {
      usuarioId_granjaId: {
        usuarioId: operarioUser.id,
        granjaId: granja.id,
      },
    },
    update: {},
    create: {
      usuarioId: operarioUser.id,
      granjaId: granja.id,
    },
  });

  console.log('✅ Usuario operario creado:', operarioUser.email);

  // 5. Crear registros de ejemplo (últimos 7 días)
  console.log('📊 Creando registros de ejemplo...');

  const categoriaAlimento = await prisma.categoria.findFirst({
    where: { nombre: 'Alimento', granjaId: granja.id },
  });
  const categoriaMedicinas = await prisma.categoria.findFirst({
    where: { nombre: 'Medicinas', granjaId: granja.id },
  });

  const hoy = new Date();

  for (let i = 6; i >= 0; i--) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - i);
    fecha.setHours(0, 0, 0, 0);

    // Verificar si ya existe un registro para esta fecha
    const existente = await prisma.registroDiario.findUnique({
      where: {
        granjaId_fecha: {
          granjaId: granja.id,
          fecha,
        },
      },
    });

    if (existente) continue;

    const huevosProducidos = Math.floor(Math.random() * 50) + 400;
    const huevosVendidos = Math.floor(huevosProducidos * 0.95);
    const precioVenta = 600;
    const ingresoTotal = huevosVendidos * precioVenta;

    await prisma.registroDiario.create({
      data: {
        fecha,
        huevosProducidos,
        huevosVendidos,
        precioVentaUnitario: precioVenta,
        ingresoTotal,
        observaciones: i === 0 ? 'Registro del día actual' : undefined,
        granjaId: granja.id,
        usuarioId: adminUser.id,
        gastos: {
          create: [
            {
              descripcion: 'Bulto de concentrado',
              monto: 85000,
              categoriaId: categoriaAlimento!.id,
            },
            {
              descripcion: 'Vitaminas',
              monto: 15000,
              categoriaId: categoriaMedicinas!.id,
            },
          ],
        },
      },
    });
  }

  console.log('✅ 7 registros de ejemplo creados');

  console.log('\n🎉 Seed completado exitosamente!\n');
  console.log('📝 Credenciales de prueba:');
  console.log('   Admin: admin@avicola.com / admin123');
  console.log('   Operario: operario@avicola.com / operario123\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
