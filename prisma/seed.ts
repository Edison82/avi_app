import { PrismaClient } from "@prisma/client";
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // 1. Crear categorías predeterminadas
  console.log('📁 Creando categorías...');
  
  const categorias = [
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

  for (const categoria of categorias) {
    await prisma.categoria.upsert({
      where: { nombre: categoria.nombre },
      update: {},
      create: categoria,
    });
  }

  console.log(`✅ ${categorias.length} categorías creadas`);

  // 2. Crear usuario de prueba (ADMIN)
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
      configuracionGranja: {
        create: {
          nombreGranja: 'Granja Demo',
          numeroGallinas: 500,
        },
      },
    },
  });

  console.log('✅ Usuario admin creado:', adminUser.email);

  // 3. Crear usuario operario de prueba
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
      configuracionGranja: {
        create: {
          nombreGranja: 'Granja El Porvenir',
          numeroGallinas: 200,
        },
      },
    },
  });

  console.log('✅ Usuario operario creado:', operarioUser.email);

  // 4. Crear registros de ejemplo (últimos 7 días)
  console.log('📊 Creando registros de ejemplo...');

  const hoy = new Date();
  const categoriaAlimento = await prisma.categoria.findUnique({
    where: { nombre: 'Alimento' },
  });
  const categoriaMedicinas = await prisma.categoria.findUnique({
    where: { nombre: 'Medicinas' },
  });

  for (let i = 6; i >= 0; i--) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - i);
    fecha.setHours(0, 0, 0, 0);

    const huevosProducidos = Math.floor(Math.random() * 50) + 400; // 400-450 huevos
    const huevosVendidos = Math.floor(huevosProducidos * 0.95); // 95% vendidos
    const precioVenta = 600; // $600 por huevo
    const ingresoTotal = huevosVendidos * precioVenta;

    await prisma.registroDiario.create({
      data: {
        fecha,
        huevosProducidos,
        huevosVendidos,
        precioVentaUnitario: precioVenta,
        ingresoTotal,
        observaciones: i === 0 ? 'Registro del día actual' : undefined,
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