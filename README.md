# Rocha Cotizador

Cotizador B2B mayorista: clientes con código + contraseña arman cotizaciones; admin gestiona productos, descuentos ocultos y remitos. El PIN de 4 dígitos es el acceso inicial; se recomienda (no obligatorio) cambiarlo por una contraseña ≥8 caracteres.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind 4
- Prisma 6 + PostgreSQL
- NextAuth v5 (Credentials: admin email/password, cliente código+contraseña)

## Setup local

```bash
cp .env.example .env
# DATABASE_URL = Neon branch **development** (ep-noisy-darkness-a6ms81wq…), never main/prod
# SEED_TARGET=development

createdb rocha_cotizador   # si aún no existe (alternativa local)
npm install
npx prisma db push
SEED_TARGET=development npm run db:seed   # Excel + PINs; blocked on Neon main
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
| `npm run dev:log` | Dev server + tee to `.logs/dev.log` (same terminal output; survives IDE console glitches) |
| `npm run dev:logs` | `tail -f .logs/dev.log` — run in a **second** terminal while `dev:log` is running |
| `npm run dev:restart` | Kill stale Next on 3000/3001 for this repo, then `dev:log` |
| `npm run dev:clean` / `dev:kill` | Clean restart / kill only (`scripts/dev-clean.sh`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint `src/` |
| `npm run db:push` | Sync schema |
| `npm run db:seed` | Seed admin + Excel (requires `SEED_TARGET=development` or `ALLOW_DESTRUCTIVE_DB=1`; refuses Neon main) |
| `npm run dev:wipe-customers` | Wipe customer PII on Neon **development** only; seeds fictitious clients (`SEED_TARGET=development`; refuses production/main) |
| `npm run db:studio` | Prisma Studio |

## Precios

- Precio base producto = `Product.basePrice` (Excel lista/col 5).
- Admin asigna `% descuento` por cliente (oculto al cliente).
- Cliente solo ve precio unitario e importe finales.
- Seed mapea listas Excel 6/7/8/9 → 20/15/10/5%.

## Rutas

- Cliente: `/login`, `/cotizar`, `/remitos`, `/remitos/[number]` (imprimible, ej. `R-000018`), `/cuenta/configuracion`
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
