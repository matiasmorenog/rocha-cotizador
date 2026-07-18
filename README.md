# Rocha Cotizador

Cotizador B2B mayorista: clientes con código + contraseña arman cotizaciones; admin gestiona productos, descuentos ocultos y remitos. El PIN de 4 dígitos es el acceso inicial; se recomienda (no obligatorio) cambiarlo por una contraseña ≥8 caracteres.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind 4
- Prisma 6 + PostgreSQL
- NextAuth v5 (Credentials: admin email/password, cliente código+contraseña)

## Setup local

```bash
cp .env.example .env
# Ajustá DATABASE_URL / AUTH_SECRET / AUTH_URL

createdb rocha_cotizador   # si aún no existe
npm install
npx prisma db push
npm run db:seed            # importa prisma/data/rocha_data.xlsx + genera PINs
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

### Credenciales

| Quién | Cómo |
|-------|------|
| Admin | Seed: `admin@rocha.com` / `admin1234` (cambiar password tras primer login; email solo en DB) |
| Cliente | Código 3 dígitos + PIN inicial en `prisma/data/seed-pins.csv` (luego cambiar a contraseña ≥8 en Configuración) |

## Scripts

| Script | Uso |
|--------|-----|
| `npm run dev` | Dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint `src/` |
| `npm run db:push` | Sync schema |
| `npm run db:seed` | Seed admin + Excel |
| `npm run db:studio` | Prisma Studio |

## Precios

- Precio base producto = lista **Mayorista** (Excel lista 5).
- Admin asigna `% descuento` por cliente (oculto al cliente).
- Cliente solo ve precio unitario e importe finales.
- Seed mapea listas Excel 6/7/8/9 → 20/15/10/5%.

## Rutas

- Cliente: `/login`, `/cotizar`, `/remitos`, `/remitos/[id]` (imprimible), `/cuenta/configuracion`
- Admin: `/admin/login`, `/admin`, `/admin/clientes`, `/admin/productos`, `/admin/cotizaciones`

## Admin Excel (export / sync)

En `/admin/clientes` y `/admin/productos`: **Descargar Excel** y **Subir / sincronizar** (upsert por `código`).

| Recurso | Export | Import |
|---------|--------|--------|
| Clientes | `GET /api/admin/customers/export` → `clientes.xlsx` | `POST /api/admin/customers/import` (multipart `file`) |
| Productos | `GET /api/admin/products/export` → `productos.xlsx` | `POST /api/admin/products/import` (multipart `file`) |

Columnas estables (mismo header export ↔ import):

- **Clientes:** `código`, `nombre`, `email`, `teléfono`, `dirección`, `condicionesPago`, `horarioEntrega`, `notas`, `descuentoPercent`, `activo`, `resetearPin`
- **Productos:** `código`, `nombre`, `rubro`, `precioBase`, `activo`

Sync: fila con código existente actualiza perfil (clientes: **no** toca `passwordHash` salvo `resetearPin=sí`); código nuevo crea registro (cliente nuevo: PIN = `pinFromCustomerCode`, `mustChangePassword=true`). Password nunca se exporta.

## Deploy

Ver [DEPLOY.md](./DEPLOY.md) y [docs/ci.md](./docs/ci.md).

## Git

`feat/*` → PR a `development` → release a `main`. Ver `.cursor/rules/git-workflow.mdc`.
