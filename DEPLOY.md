# Deploy — Rocha Cotizador

## Infra (primera producción)

| Pieza | Nombre / URL |
|-------|----------------|
| GitHub | [`matiasmorenog/rocha-cotizador`](https://github.com/matiasmorenog/rocha-cotizador) (privado) |
| Vercel | proyecto `rocha-cotizador` (team `tutemorenos-projects`) → https://rocha-cotizador.vercel.app |
| Neon | proyecto `rocha-cotizador` (org Nexus), región AWS `us-west-2`, DB `neondb` |
| Neon branches | **`main`** = Production · **`development`** = Preview + local |
| Env | `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` |

## Modelo de bases (2 DBs)

Solo **dos** branches Neon. Preview **no** crea branch Neon por deploy.

| Neon branch | Quién la usa | Vercel target |
|-------------|--------------|---------------|
| `main` (`br-late-truth-a6i3aziz`) | Producción | **Production** `DATABASE_URL` (pooled) |
| `development` (`br-curly-truth-a6lzrk5r`) | Preview + local | **Preview** `DATABASE_URL` (pooled); local `.env` = **direct** |

**No** habilitar Neon↔Vercel “create branch per preview/deploy”. Si aparece esa integración, desactivarla: Preview debe apuntar siempre a Neon `development`.

Hosts (password en dashboard / `vercel env`; no commitear):

| Uso | Host |
|-----|------|
| Preview (pooled) | `ep-noisy-darkness-a6ms81wq-pooler.us-west-2.aws.neon.tech` |
| Local / `db push` (direct) | `ep-noisy-darkness-a6ms81wq.us-west-2.aws.neon.tech` |
| Production (pooled) | `ep-cool-mud-a6k5vosf-pooler.us-west-2.aws.neon.tech` |

## Variables

```bash
# Vercel: Neon pooled + pgbouncer=true&connection_limit=1 (Prisma + serverless = 1 conn/instance)
DATABASE_URL=postgresql://...-pooler...?sslmode=require&pgbouncer=true&connection_limit=1
AUTH_SECRET=                    # openssl rand -base64 32
AUTH_URL=https://rocha-cotizador.vercel.app
```

En Vercel: **Production** → Neon `main` (pooled). **Preview** → Neon `development` (pooled). No commitear `.env`.

### Neon + Prisma (conexiones)

Una sola variable: `DATABASE_URL` (Prisma ya no usa `directUrl` / `DIRECT_URL`).

| Dónde | `DATABASE_URL` recomendada |
|-------|----------------------------|
| **Vercel Production** | Neon `main` host **`-pooler`** + `pgbouncer=true&connection_limit=1` |
| **Vercel Preview** | Neon `development` host **`-pooler`** + mismos query params |
| **Local** (dev / `db push` / seed) | Neon `development` URL **directa** (sin `-pooler`) o Postgres local |

`prisma db push` contra pooler Neon en transaction mode puede fallar. Si local usás pooler y push falla, cambiá temporalmente:

```bash
DATABASE_URL="postgresql://...@ep-noisy-darkness-a6ms81wq.us-west-2.aws.neon.tech/neondb?sslmode=require" npx prisma db push
```

Dashboard admin serializa queries en `$transaction` (no `Promise.all` de 4 counts) para no abrir 4 conexiones a la vez.

### Cache (Next.js)

| Tag | Qué cachea | Invalidar |
|-----|------------|-----------|
| `products` | Catálogo base activos (`basePrice`, sin `unitPrice`) | Admin producto create/update + import Excel |
| `admin-dashboard` | Counts + últimas cotizaciones (TTL ~120s) | Quote create; también product/customer mutate |

Helpers: `src/lib/cache-tags.ts` (`invalidateAfterProductMutation`, `invalidateAfterCustomerMutation`, `invalidateAfterQuoteCreate`).

Build command (Vercel): `npm run build` → `prisma generate && next build` (`postinstall` también corre `prisma generate`).

### CI → producción (gate)

- Auto-deploy Vercel en **`main` está OFF** (`vercel.json`).
- Push/merge a `main` → Actions: **lint-and-typecheck** → **deploy-production**.
- Secrets en GitHub: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (ver [`docs/ci.md`](docs/ci.md)).

Previews de `development` / PRs siguen con el deploy automático de Vercel.

## Seed

**Nunca** seed / reset PINs / scripts de mutación masiva contra Neon `main`.

Guard: `prisma/assert-safe-db.ts` (llamado por `prisma/seed.ts` y `scripts/*`):

1. Rechaza host de producción (`ep-cool-mud-a6k5vosf`) siempre.
2. Exige `SEED_TARGET=development` **o** `ALLOW_DESTRUCTIVE_DB=1` (solo non-prod, p.ej. Postgres local).
3. Con `SEED_TARGET=development`, la URL debe ser el endpoint de Neon `development`.

Local (`.env` = URL **direct** de branch `development` + `SEED_TARGET=development`):

```bash
npx prisma db push
SEED_TARGET=development npm run db:seed
```

Seed hace **upsert** de productos/clientes (no `deleteMany`). Con `RESET_PINS=1` regenera PINs de clientes existentes.

PINs de clientes: `prisma/data/seed-pins.csv` (gitignored). Entregar PINs a clientes de forma segura.

Admin seed default (constantes en `prisma/seed.ts`): `admin@rocha.com` / `admin1234` — **cambiar password** en `/admin/cuenta` antes de go-live.

## Branches (Git)

- `development` — integración / preview (default del repo); misma DB Neon `development`
- `main` — producción (Vercel Production branch; release PR `development` → `main`; deploy solo vía Actions); DB Neon `main`

## Checklist go-live (semana de uso real)

### Neon / env

- [x] Env Vercel: Production → Neon `main`; Preview → Neon `development`
- [x] Branch Neon `development` (copia de `main`; permanente; no TTL)
- [x] Seed admin + catálogo (en Neon `main` al go-live; re-seed `development` si hace falta)
- [ ] Local `.env` apunta a Neon `development` (direct)

### Seguridad / acceso

- [ ] Cambiar password admin (no dejar `admin1234`)
- [ ] Confirmar `AUTH_SECRET` fuerte y distinto en Production
- [ ] Confirmar `AUTH_URL=https://rocha-cotizador.vercel.app` en Production
- [ ] WhatsApp avisos: número correcto en `/admin/configuracion`
- [ ] Entregar PINs/credenciales a clientes por canal seguro (no commit)

### CI / deploy

- [ ] Secrets GitHub `VERCEL_*` cargados
- [ ] Merge a `development` solo con `lint-and-typecheck` verde
- [ ] Release: PR `development` → `main`; esperar job `deploy-production` verde
- [ ] Smoke en https://rocha-cotizador.vercel.app tras el release

### Smoke test producción

- [ ] Login admin + cliente
- [ ] Cotizar → observaciones → confirmar → remito
- [ ] Link remito sin sesión → `/entrar` → admin ve remito
- [ ] WhatsApp `wa.me` abre con datos del pedido
- [ ] Imprimir remito
- [ ] Buscador productos (catálogo) lista resultados

### Ops

- [ ] Neon: saber cómo restaurar / contactar backup del plan
- [ ] Quién mergea a `main` la semana de go-live (una persona)
