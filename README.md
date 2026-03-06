

# 🐔 AviControl - Sistema de Gestión Avícola

Sistema web para la gestión diaria de empresas avícolas dedicadas a la producción de huevos. Permite registrar gastos, producción, ventas y calcular automáticamente la rentabilidad del negocio.

## 📋 Características

- ✅ **Dashboard en tiempo real** con indicadores diarios y semanales
- ✅ **Registro de producción diaria** de huevos
- ✅ **Control de gastos** por categorías personalizables
- ✅ **Cálculo automático** de ingresos y ganancias
- ✅ **Gráficos y visualizaciones** de tendencias
- ✅ **Histórico completo** con filtros y búsqueda
- ✅ **Sistema de roles** (Admin/Operario)
- ✅ **Responsive design** para móviles y tablets

## 🛠️ Stack Tecnológico

- **Frontend:** Next.js 14, React 18, TypeScript
- **Estilos:** Tailwind CSS
- **Backend:** Next.js API Routes
- **Base de Datos:** PostgreSQL
- **ORM:** Prisma
- **Autenticación:** NextAuth.js
- **Validaciones:** Zod + React Hook Form
- **Gráficos:** Recharts

## 📦 Instalación

### Prerrequisitos

- Node.js 18+
- PostgreSQL 14+ (local o en la nube)
- npm o yarn

### Pasos

1. **Clonar el repositorio**

bash

`git clone <url-del-repo>
cd avicola-app`

1. **Instalar dependencias**

bash

`npm install`

1. **Configurar variables de entorno**

Crear archivo `.env.local` en la raíz:

env

`DATABASE_URL="postgresql://usuario:password@localhost:5432/avicola_db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="tu-secret-generado"`

Generar NEXTAUTH_SECRET:

bash

`openssl rand -base64 32`

1. **Levantar base de datos (con Docker)**

bash

`docker-compose up -d`

O configurar PostgreSQL manualmente.

1. **Ejecutar migraciones**

bash

`npx prisma migrate dev`

1. **Ejecutar seed (datos iniciales)**

bash

`npm run db:seed`

Esto creará:

- 6 categorías predeterminadas
- Usuario admin: `admin@avicola.com` / `admin123`
- Usuario operario: `operario@avicola.com` / `operario123`
- 7 días de registros de ejemplo
1. **Iniciar el servidor de desarrollo**

bash

`npm run dev`

Abrir [http://localhost:3000](http://localhost:3000/)

## 🗄️ Comandos de Base de Datos

bash

`*# Ver base de datos visualmente*
npm run db:studio

*# Crear nueva migración*
npx prisma migrate dev --name nombre_migracion

*# Resetear base de datos (¡CUIDADO!)*
npm run db:reset

*# Sincronizar schema sin migraciones*
npm run db:push

*# Regenerar cliente Prisma*
npx prisma generate`

## 📂 Estructura del Proyecto

`avicola-app/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── registro/page.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   ├── registros/
│   │   │   ├── categorias/
│   │   │   └── configuracion/
│   │   └── layout.tsx
│   ├── api/
│   │   ├── auth/
│   │   ├── registros/
│   │   ├── gastos/
│   │   ├── categorias/
│   │   ├── dashboard/
│   │   └── configuracion/
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   └── Alert.tsx
│   └── Providers.tsx
├── lib/
│   ├── auth.ts
│   ├── prisma.ts
│   └── validations/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── types/
│   └── index.ts
└── middleware.ts`

## 🔐 Usuarios de Prueba

Después de ejecutar el seed:

**Administrador:**

- Email: `admin@avicola.com`
- Password: `admin123`
- Permisos: Todos

**Operario:**

- Email: `operario@avicola.com`
- Password: `operario123`
- Permisos: Registros y consultas

## 📊 API Endpoints

### Autenticación

- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/[...nextauth]` - Login

### Registros Diarios

- `GET /api/registros` - Listar registros
- `POST /api/registros` - Crear registro
- `GET /api/registros/[id]` - Obtener registro
- `PUT /api/registros/[id]` - Actualizar registro
- `DELETE /api/registros/[id]` - Eliminar registro

### Categorías

- `GET /api/categorias` - Listar categorías
- `POST /api/categorias` - Crear categoría (ADMIN)
- `PUT /api/categorias/[id]` - Actualizar (ADMIN)
- `PATCH /api/categorias/[id]` - Activar/desactivar (ADMIN)

### Dashboard

- `GET /api/dashboard/indicadores?tipo=hoy` - Indicadores del día
- `GET /api/dashboard/indicadores?tipo=semanal` - Indicadores semanales

### Configuración

- `GET /api/configuracion` - Obtener configuración
- `POST /api/configuracion` - Crear configuración
- `PUT /api/configuracion` - Actualizar configuración


## 📝 Licencia

Este proyecto es de código abierto

## 👥 Autor

Edison Arley Liberato Mendoza

## 🐛 Reporte de Bugs

Si encuentras un bug, por favor abre un issue con:

- Descripción del problema
- Pasos para reproducirlo
- Comportamiento esperado
- Screenshots (si aplica)

## 📧 Contacto

ediflow82@gmail.com
