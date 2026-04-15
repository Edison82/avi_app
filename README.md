# AviControl — Sistema de Gestión Avícola

Sistema web multi-tenant para la gestión integral de granjas avícolas productoras de huevos. Permite registrar y analizar producción diaria, controlar gastos por categorías, gestionar entregas, cargas y movimientos de inventario, con cálculo automático de indicadores de rentabilidad.

---

## Tabla de contenidos

- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Requisitos previos](#requisitos-previos)
- [Instalación y configuración](#instalación-y-configuración)
- [Variables de entorno](#variables-de-entorno)
- [Comandos disponibles](#comandos-disponibles)
- [Estructura del proyecto](#estructura-del-proyecto)
- [API Endpoints](#api-endpoints)
- [Roles y permisos](#roles-y-permisos)
- [Modelo de datos](#modelo-de-datos)

---

## Características

- Dashboard con indicadores diarios y semanales en tiempo real
- Registro de producción diaria (turno mañana / tarde) por categoría de huevo
- Control de gastos por categorías personalizables con campos dinámicos
- Gestión de entregas a conductores con desglose por categoría (JUMBO, AAA, AA, A, B, C)
- Control de cargas asignadas a conductores
- Inventario de huevos por categoría con trazabilidad
- Inventario de insumos con movimientos de entrada/salida
- Precios de huevo configurables por categoría
- Gestión de usuarios con tres roles diferenciados
- Onboarding guiado para creación de granja
- Diseño responsive para móvil, tablet y escritorio

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + TypeScript |
| Estilos | Tailwind CSS v4 + PostCSS |
| Autenticación | NextAuth.js v5 (beta) — JWT + Credentials provider |
| ORM | Prisma 6 |
| Base de datos | PostgreSQL (NeonDB en producción) |
| Validación | Zod v4 + React Hook Form v7 |
| Gráficos | Recharts v3 |
| Iconos | Lucide React |
| Cifrado | bcryptjs |
| Despliegue | Render |

---

## Arquitectura

### Multi-tenancy

Cada `Granja` es un tenant independiente. Todos los datos (registros, gastos, entregas, inventario, categorías) están aislados por `granjaId`. El `ADMIN` crea y administra la granja; los demás roles son asignados explícitamente.

### Flujo de autenticación

`lib/auth.config.ts` define el proveedor Credentials y los callbacks JWT que añaden `granjaId`, `rol` e `id` al token de sesión. `lib/auth.ts` exporta `{ auth, signIn, signOut, handlers }`.

El middleware (`middleware.ts`) redirige a `/setup` si el usuario autenticado aún no tiene una granja asociada.

### Seguridad en rutas API

Todas las rutas API usan `lib/getGranjaId.ts` como límite de seguridad central. Esta función valida la sesión y devuelve `{ granjaId, usuarioId, rol }`, garantizando que cada consulta esté aislada al tenant correspondiente.

```ts
const { granjaId, usuarioId, rol } = await getGranjaId();
```

---

## Requisitos previos

- Node.js 20+
- PostgreSQL 15+ (local o instancia en la nube)
- npm 10+

---

## Instalación y configuración

**1. Clonar el repositorio**

```bash
git clone <url-del-repositorio>
cd avi_app
```

**2. Instalar dependencias**

```bash
npm install
```

**3. Configurar variables de entorno**

Crear el archivo `.env` en la raíz del proyecto (ver sección [Variables de entorno](#variables-de-entorno)).

**4. Aplicar el esquema a la base de datos**

```bash
npm run db:push
```

O ejecutar migraciones formales en entornos con historial:

```bash
npm run db:migrate
```

**5. Poblar con datos iniciales (opcional)**

```bash
npm run db:seed
```

**6. Iniciar el servidor de desarrollo**

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

---

## Variables de entorno

Crear un archivo `.env` en la raíz. **Nunca incluir este archivo en el control de versiones.**

```env
# Conexión principal (con pooling — usada por Prisma en runtime)
DATABASE_URL="postgresql://<usuario>:<password>@<host>/<base_de_datos>?sslmode=require"

# Conexión directa (sin pooling — usada por migraciones y Prisma Studio)
DIRECT_URL="postgresql://<usuario>:<password>@<host>/<base_de_datos>?sslmode=require"

# URL base de la aplicación
NEXTAUTH_URL="http://localhost:3000"

# Secreto para firmar tokens JWT (mínimo 32 caracteres aleatorios)
# Generar con: openssl rand -base64 32
AUTH_SECRET="<secreto-generado>"
```

> En producción, configurar estas variables directamente en el panel del proveedor de despliegue. `NEXTAUTH_URL` no es necesaria si el proveedor establece `NEXTAUTH_URL_INTERNAL` automáticamente.

---

## Comandos disponibles

```bash
# Desarrollo
npm run dev          # Inicia el servidor en localhost:3000

# Producción
npm run build        # Genera cliente Prisma + compila la aplicación
npm run start        # Inicia el servidor en modo producción

# Calidad de código
npm run lint         # Ejecuta ESLint

# Base de datos
npm run db:push      # Sincroniza el schema sin crear migraciones (solo desarrollo)
npm run db:migrate   # Crea y aplica migraciones
npm run db:seed      # Inserta datos iniciales
npm run db:studio    # Abre Prisma Studio en el navegador
```

---

## Estructura del proyecto

```
avi_app/
├── app/
│   ├── api/
│   │   ├── auth/               # Registro y handlers de NextAuth
│   │   ├── campos/             # Campos dinámicos de categorías
│   │   ├── cargas/             # Cargas asignadas a conductores
│   │   ├── categorias/         # Categorías de gastos + campos
│   │   ├── configuracion/      # Configuración de granja y usuarios
│   │   ├── dashboard/          # Indicadores diarios y semanales
│   │   ├── entregas/           # Entregas de huevos
│   │   ├── gastos/             # Gastos diarios
│   │   ├── granjas/            # Información de la granja
│   │   ├── inventario/         # Inventario de insumos y movimientos
│   │   ├── precios-huevo/      # Precios por categoría de huevo
│   │   ├── registros/          # Registros diarios de producción
│   │   └── setup/              # Onboarding — creación de granja
│   ├── auth/
│   │   ├── login/
│   │   └── registro/
│   ├── dashboard/
│   │   ├── categorias/
│   │   ├── carga/
│   │   ├── configuracion/
│   │   ├── entregas/
│   │   ├── inventario/
│   │   ├── registros/
│   │   │   ├── [id]/editar/
│   │   │   └── nuevo/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── setup/
│   ├── globals.css
│   └── layout.tsx
├── components/
│   └── ui/
│       ├── Alert.tsx
│       ├── Button.tsx
│       ├── Card.tsx
│       └── Input.tsx
├── lib/
│   ├── auth.config.ts          # Configuración NextAuth (proveedor, callbacks JWT)
│   ├── auth.ts                 # Exporta auth, signIn, signOut, handlers
│   ├── format.ts               # Utilidades de formateo y constantes de categorías
│   ├── getGranjaId.ts          # Límite de seguridad para rutas API
│   ├── prisma.ts               # Instancia singleton de PrismaClient
│   └── validations/
│       └── schemas.ts          # Esquemas Zod centralizados
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── scripts/
├── middleware.ts
└── prisma.config.ts
```

---

## API Endpoints

Todas las rutas devuelven `{ success: true, data, message }` o `{ success: false, error }`.

### Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Registro de nuevo usuario |
| POST | `/api/auth/[...nextauth]` | Login / logout (NextAuth) |

### Registros diarios

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/registros` | Listar registros con paginación y filtros |
| POST | `/api/registros` | Crear registro de producción |
| GET | `/api/registros/[id]` | Obtener registro por ID |
| PUT | `/api/registros/[id]` | Actualizar registro |
| DELETE | `/api/registros/[id]` | Eliminar registro |

### Categorías de gastos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/categorias` | Listar categorías |
| POST | `/api/categorias` | Crear categoría *(ADMIN)* |
| PUT | `/api/categorias/[id]` | Actualizar categoría *(ADMIN)* |
| PATCH | `/api/categorias/[id]` | Activar/desactivar *(ADMIN)* |
| GET | `/api/categorias/[id]/campos` | Campos dinámicos de una categoría |
| POST | `/api/categorias/[id]/campos` | Añadir campo dinámico |
| PUT | `/api/campos/[id]` | Actualizar campo |
| DELETE | `/api/campos/[id]` | Eliminar campo |

### Dashboard

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/dashboard/indicadores?tipo=hoy` | Indicadores del día |
| GET | `/api/dashboard/indicadores?tipo=semanal` | Indicadores de los últimos 7 días |

### Entregas y cargas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/entregas` | Listar entregas |
| POST | `/api/entregas` | Registrar entrega |
| GET | `/api/cargas` | Listar cargas |
| POST | `/api/cargas` | Registrar carga |
| PUT | `/api/cargas/[id]` | Actualizar carga |
| DELETE | `/api/cargas/[id]` | Eliminar carga |

### Inventario de insumos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/inventario` | Resumen de inventario |
| GET | `/api/inventario/insumos` | Listar insumos |
| POST | `/api/inventario/insumos` | Crear insumo |
| PUT | `/api/inventario/insumos/[id]` | Actualizar insumo |
| POST | `/api/inventario/historial` | Registrar movimiento |
| GET | `/api/inventario/permisos` | Permisos de operario sobre inventario |

### Configuración

| Método | Ruta | Descripción |
|---|---|---|
| GET/PUT | `/api/configuracion` | Configuración de la granja |
| GET | `/api/configuracion/usuarios` | Listar usuarios de la granja *(ADMIN)* |
| PUT | `/api/configuracion/usuarios/[id]` | Actualizar usuario *(ADMIN)* |
| PATCH | `/api/configuracion/usuarios/[id]/estado` | Activar/desactivar usuario *(ADMIN)* |
| GET/POST | `/api/precios-huevo` | Precios por categoría de huevo |

---

## Roles y permisos

| Rol | Descripción |
|---|---|
| `ADMIN` | Acceso completo. Administra usuarios, categorías, configuración y precios. |
| `OPERARIO` | Gestiona registros diarios, cargas y entregas. Acceso de lectura al inventario según permisos. |
| `CONDUCTOR` | Acceso restringido a entregas asignadas (`EntregaConductor`). |

---

## Modelo de datos

Los modelos principales del esquema Prisma son:

| Modelo | Descripción |
|---|---|
| `Granja` | Tenant principal. Agrupa toda la información de una granja. |
| `Usuario` | Usuario de la aplicación. Pertenece a una granja con un rol asignado. |
| `RegistroDiario` | Producción diaria de huevos (turno mañana/tarde). |
| `GastoDiario` | Gasto asociado a un registro y una categoría. |
| `Categoria` | Categoría de gasto personalizable con campos dinámicos. |
| `CampoCategoria` | Campo dinámico de una categoría (número, texto, etc.). |
| `EntregaConductor` | Entrega de huevos con desglose por categoría en JSON. |
| `CargaConductor` | Carga asignada a un conductor. |
| `InventarioHuevos` | Stock de huevos por categoría (JUMBO, AAA, AA, A, B, C). |
| `InsumoInventario` | Insumo con stock actual y mínimo. |
| `MovimientoInsumo` | Entrada o salida de un insumo. |
| `PrecioHuevoCategoria` | Precio de venta configurado por categoría de huevo. |
| `ConfiguracionGranja` | Configuración general de la granja (nombre, número de gallinas). |
| `PermisoOperario` | Permiso de un operario sobre un módulo específico. |

---

## Licencia

Este proyecto es de uso académico. Todos los derechos reservados al autor.
