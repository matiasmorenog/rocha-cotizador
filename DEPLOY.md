# Deploy — Rocha Cotizador

## Infra (primera producción)

| Pieza | Nombre / URL |
|-------|----------------|
| GitHub | [`matiasmorenog/rocha-cotizador`](https://github.com/matiasmorenog/rocha-cotizador) (privado) |
| Vercel | proyecto `rocha-cotizador` (team `tutemorenos-projects`) → https://rocha-cotizador.vercel.app |
| Neon | proyecto `rocha-cotizador` (org Nexus), región AWS `us-west-2`, DB `neondb` |
| Neon branches | **`main`** = Production · **`development`** = Preview + Development + local |
| Env | `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` |

## Modelo de bases (2 DBs)

Solo **dos** branches Neon. Preview **no** crea branch Neon por deploy.

| Neon branch | Quién la usa | Vercel target |
|-------------|--------------|---------------|
| `main` (`br-late-truth-a6i3aziz`) | Producción | **Production** `DATABASE_URL` (pooled) |
| `development` (`br-curly-truth-a6lzrk5r`) | Preview + Vercel Development + local | **Preview** y **Development** = misma `DATABASE_URL` (pooled); local `.env` = **direct** |

**No** habilitar Neon↔Vercel “create branch per preview/deploy”. Si aparece esa integración, desactivarla: Preview debe apuntar siempre a Neon `development`.

**Vercel Preview ≡ Development:** mismas variables (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, …) y mismo Neon `development`. **Production** aislado (Neon `main` + secrets propios). No copiar Production → Preview/Development.

En el proyecto **`rocha-cotizador`**, Preview de git branch `development` usa overrides `gitBranch=development`: `DATABASE_URL` = Neon `development` pooled (`ep-noisy-darkness…-pooler`); `AUTH_URL` = alias git de esa branch. El scope **Production** no se toca.

### Schema drift / wrong DB (léelo antes de un release)

**Local DB ≠ production.** Son dos bases Neon distintas. Agentes: cualquier cambio Neon (schema, pooler/`DATABASE_URL`, branches) también en Production — ver `.cursor/rules/neon-prod-parity.mdc`.

| Dónde | Neon branch | Cómo lo reconocés (host prefix) |
|-------|-------------|----------------------------------|
| Local `.env` `DATABASE_URL` | **development** | `ep-noisy-darkness…` (direct, sin `-pooler`) |
| Vercel Preview / Development | **development** | `ep-noisy-darkness…-pooler…` |
| Vercel **Production** | **main** | `ep-cool-mud…-pooler…` |

- `npx prisma db push` con tu `.env` local **solo** actualiza Neon **development**. **No** toca producción.
- Si el release cambia `prisma/schema.prisma`, **antes** del merge a `main` hacé `db push` contra Neon **main** con la URL **direct** de Production (dashboard Neon / `vercel env pull --environment=production`), **no** el pooler y **no** el `.env` local.
- Ejemplo (password en dashboard; no commitear):

```bash
# WRONG — local .env = development only
npx prisma db push

# RIGHT — Neon main direct (host ep-cool-mud… without -pooler)
DATABASE_URL="postgresql://…@ep-cool-mud-….us-west-2.aws.neon.tech/neondb?sslmode=require" npx prisma db push
DATABASE_URL="…" npm run db:check-sync
```

Outage histórico: código en prod pedía `User.inAppNotificationsEnabled` / tablas nuevas; Neon `main` sin la columna → Auth Configuration → login admin fallaba como “password incorrecta”. Gates: pre-deploy `scripts/check-schema-sync.sh` + `GET /api/health` (ver [`docs/ci.md`](docs/ci.md)).

Hosts (password en dashboard / `vercel env`; no commitear):

| Uso | Host |
|-----|------|
| Preview + Vercel Development (pooled) | `ep-noisy-darkness-a6ms81wq-pooler.us-west-2.aws.neon.tech` |
| Local / `db push` (direct) | `ep-noisy-darkness-a6ms81wq.us-west-2.aws.neon.tech` |
| Production (pooled) | `ep-cool-mud-a6k5vosf-pooler.us-west-2.aws.neon.tech` |
| Production `db push` (direct) | `ep-cool-mud-a6k5vosf.us-west-2.aws.neon.tech` (sin `-pooler`) |

## Variables

```bash
# Vercel: Neon pooled + pgbouncer=true&connection_limit=1 (Prisma + serverless = 1 conn/instance)
# Optional: &connect_timeout=15 if cold connects flake (Neon us-west-2 from Vercel).
DATABASE_URL=postgresql://...-pooler...?sslmode=require&pgbouncer=true&connection_limit=1
AUTH_SECRET=                    # openssl rand -base64 32
AUTH_URL=https://rocha-cotizador.vercel.app

# Web Push (admin notificaciones de cotización nueva) — mismas keys en Preview + Production + local
NEXT_PUBLIC_VAPID_PUBLIC_KEY=   # npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=              # nunca commitear
VAPID_SUBJECT=https://rocha-cotizador.vercel.app
```

En Vercel: **Production** → Neon `main` (pooled) + secrets prod. **Preview ≡ Development** → Neon `development` (pooled) + mismos `AUTH_*`. Local `.env` (gitignored): Neon `development` **direct** + `AUTH_URL=http://localhost:3000` + `SEED_TARGET=development`.

### Web Push (notificaciones admin)

Cuando un **cliente** crea una cotización, el servidor manda Web Push a admins suscriptos (Chrome). Config:

1. Generar un par VAPID una vez: `npx web-push generate-vapid-keys`
2. Cargar en Vercel (**Production**, **Preview** y **Development**) y en `.env` local:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` (URL del sitio, ej. `https://rocha-cotizador.vercel.app` — contacto VAPID, no envía mail)
3. Schema: modelo `PushSubscription` — `npx prisma db push` en Neon **development**; **antes del release a prod** también contra Neon `main`.
4. Admin activa en `/admin/configuracion` → “Activar notificaciones del sistema”.

Sin estas env, el create de cotización sigue OK (solo se loguea y se salta el push).

### Neon + Prisma (conexiones)

Una sola variable: `DATABASE_URL` (Prisma ya no usa `directUrl` / `DIRECT_URL`).

| Dónde | `DATABASE_URL` recomendada |
|-------|----------------------------|
| **Vercel Production** | Neon `main` host **`-pooler`** + `pgbouncer=true&connection_limit=1` |
| **Vercel Preview** | Neon `development` host **`-pooler`** + mismos query params |
| **Vercel Development** | Misma URL pooled que Preview (Neon `development`) |
| **Local** (dev / `db push` / seed) | Neon `development` URL **directa** (sin `-pooler`) o Postgres local |

`prisma db push` contra pooler Neon en transaction mode puede fallar. Si local usás pooler y push falla, cambiá temporalmente:

```bash
DATABASE_URL="postgresql://...@ep-noisy-darkness-a6ms81wq.us-west-2.aws.neon.tech/neondb?sslmode=require" npx prisma db push
```

Dashboard admin serializa queries en `$transaction` (no `Promise.all` de 4 counts) para no abrir 4 conexiones a la vez.

### Timeouts (Vercel / Neon)

Neon `us-west-2` cold ~3–4s. Default serverless `maxDuration` (~15s Pro) deja poco margen para export PDF/XLSX, create cotización + Web Push, o login (bcrypt + DB).

Segment config en rutas pesadas (`export const maxDuration = 60` en import/export/quotes; `30` en auth/remito; `15` en health). No hace falta `maxDuration` global en `vercel.json`.

| Runtime `DATABASE_URL` (Vercel) | Schema gate / `db push` |
|--------------------------------|-------------------------|
| Neon **`-pooler`** + `pgbouncer=true&connection_limit=1` | Neon **direct** (sin `-pooler`) — secret `DATABASE_URL_PRODUCTION` o URL direct al push |

Si Production runtime usa host **sin** `-pooler`: riesgo de agotar conexiones bajo concurrencia + cold más caro. Corregí a pooler en Vercel **Production** (y Preview/Development al pooler de `development`). No tocar secrets sin confirmación.

### Cache (Next.js)

| Tag | Qué cachea | Invalidar |
|-----|------------|-----------|
| `products` | Catálogo base activos (`basePrice`, sin `unitPrice`) | Admin producto create/update + import Excel |
| `price-lists` | Precios por lista | Price list mutate; product import |
| `customers` | Mapping customerId → priceListId | Customer mutate; price list delete |
| `admin-dashboard` | Counts + últimas cotizaciones (TTL 24h) | Quote create/wipe; product/customer mutate |

Helpers: `src/lib/cache-tags.ts` (`invalidateAfterProductMutation`, `invalidateAfterCustomerMutation`, `invalidateAfterQuoteCreate`, `invalidateAllDataCaches`, `invalidateAfterDbScript`).

Ops / wipe / scripts out-of-band: `POST /api/revalidate` con `REVALIDATE_SECRET` + `AUTH_URL` → `invalidateAfterDbScript` (todas las tags + paths admin/remitos). Obligatorio tras cualquier mutación DB fuera de la app.

**Después de cada deploy** (automático: Actions `deploy-production` en `main`, y `post-deploy-cache-development` en push a `development`):

```bash
# Prefer the script (CDN + Data + tags + brand Image Optimization):
VERCEL_ORG_ID=team_QxlnpSeR7a1AsZiXtKSsqWFJ \
VERCEL_PROJECT_ID=prj_… \
VERCEL_TOKEN=… \
bash scripts/post-deploy-cache.sh
```

Tags = `Object.values(CACHE_TAGS)` en `src/lib/cache-tags.ts`. Si agregás una tag nueva, actualizá `scripts/post-deploy-cache.sh` y este párrafo.

Build command (Vercel): `npm run build` → `prisma generate && next build` (`postinstall` también corre `prisma generate`). `binaryTargets` in `schema.prisma` must include `rhel-openssl-3.0.x` so the client works on Vercel when CI generates on Debian.

### CI → producción (gate)

- Auto-deploy Vercel en **`main` está OFF** (`vercel.json`).
- Push/merge a `main` → Actions: **lint-and-typecheck** → **deploy-production** (incluye **pre-deploy schema sync** + **post-deploy smoke**: `/api/health` + homepage + **post-deploy cache revalidate**: CDN + Data + tags + brand images).
- Push a `development` → Git Preview en **`rocha-cotizador`** (SSO; `DATABASE_URL`/`AUTH_URL` override `gitBranch=development` → Neon development) **y** Git Production en **`rocha-cotizador-dev`** (público, portfolio). Después Actions **post-deploy-cache-development** (purge contra el proyecto demo).
- Ready feature PRs → Preview **solo** en **`rocha-cotizador`**. **`rocha-cotizador-dev`** no lanza Preview de PRs (ignore cancela; solo actualiza al merge a `development`).
- Secrets en GitHub: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (ver [`docs/ci.md`](docs/ci.md)).
- Opcional pero recomendado: `DATABASE_URL_PRODUCTION` (Neon `main`, preferible URL **direct**) para el gate de schema sin depender solo de `vercel pull`.

## Client production (obligatorio)

Producto **real frente a clientes**. Outages recientes no se repiten:

1. **Schema:** nunca mergear a `main` un cambio de `prisma/schema.prisma` sin `db push` a Neon **main** ya verificado (`npm run db:check-sync` / gate de Actions). `db push` local = solo Neon **development**.
2. **Chrome crítico (sidebar admin):** nunca usar utilidades Tailwind one-off de visibilidad (`hidden lg:block`, etc.) para chrome que debe vivir siempre. Visibilidad del sidebar = clases en `src/app/globals.css` (`.admin-desktop-sidebar`). CI falla si falta la clase o si `admin-nav` vuelve a `lg:block`.
3. **Hard refresh:** tras deploy de CSS/layout, pedí a quien reporte UI rota un hard refresh (Cmd/Ctrl+Shift+R) antes de asumir regresión — cache de chunk CSS viejo miente.

## Rollback rápido

Si prod queda mal tras un release:

```bash
# Preferido — promover el deployment anterior sano:
vercel rollback https://rocha-cotizador.vercel.app --token "$VERCEL_TOKEN"

# Alternativa UI: Vercel → Project → Deployments → ⋮ en el deployment verde anterior → Promote
# Alternativa Actions: re-run del último workflow verde en `main` (Redeploy)
```

Después del rollback: confirmar `GET /api/health` → 200 y login admin. Si el fallo era **schema_drift**, rollback de código solo no alcanza — hay que alinear Neon `main` (push o revert de columnas) con el schema del código que queda en prod.

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

Admin seed default (constantes en `prisma/seed.ts`): `admin@rocha.com` / `admin1234`. Email vive en DB, no en env. Password se cambia en `/admin/cuenta`.

**Importante:** passwords seed (admin + PINs clientes) se dejan **tal cual** hasta que el admin real confirme que go-live está listo. Rotar admin password y PINs **recién al último momento** antes del uso real en producción — no cambiar seed data ni rotar credenciales ahora.

## Branches (Git)

- `development` — integración / preview (default del repo); misma DB Neon `development`
- `main` — producción (Vercel Production branch; release PR `development` → `main`; deploy solo vía Actions); DB Neon `main`

## Checklist go-live (semana de uso real)

### Neon / env

- [x] Env Vercel: Production → Neon `main`; Preview ≡ Development (todas las vars → Neon `development`)
- [x] Branch Neon `development` (copia de `main`; permanente; no TTL)
- [x] `prisma db push` contra Neon (según target)
- [x] Seed admin + catálogo (en Neon `main` al go-live; re-seed `development` si hace falta)
- [x] Local `.env` apunta a Neon `development` (direct) + `SEED_TARGET=development`

### Go-live (uso real) — último momento

- [ ] Cambiar password admin (no dejar `admin1234`) en `/admin/cuenta` — solo cuando el admin real diga que go-live está listo
- [ ] Rotar / entregar PINs de clientes por canal seguro — mismo momento; hasta entonces las credenciales seed se quedan como están

### Seguridad / acceso

- [ ] Confirmar `AUTH_SECRET` fuerte y distinto en Production
- [ ] Confirmar `AUTH_URL=https://rocha-cotizador.vercel.app` en Production
- [ ] WhatsApp notificaciones: número correcto en `/admin/configuracion`
- [ ] VAPID Web Push en Vercel (Production + Preview/Development) + admin activó notificaciones en `/admin/configuracion`
- [ ] `prisma db push` en Neon `main` incluye tabla `PushSubscription` (si el release trae ese modelo)
- [ ] `prisma db push` en Neon `main` incluye columna `Quote.deliveryDate` (`DATE`, nullable) si el release trae pedidos con fecha de entrega

### Release (cada PR `development` → `main` con cambios de schema)

- [ ] `prisma db push` en Neon **main** (URL Production **direct** `ep-cool-mud…`, **no** local `.env` / `ep-noisy-darkness…`)
- [ ] `DATABASE_URL=<neon-main-direct> npm run db:check-sync` verde
- [ ] Checklist del PR template (sección Release) completa

### CI / deploy

- [ ] Secrets GitHub `VERCEL_*` cargados (+ opcional `DATABASE_URL_PRODUCTION`)
- [ ] Merge a `development` solo con `lint-and-typecheck` verde
- [ ] Release: PR `development` → `main`; esperar job `deploy-production` verde (schema gate + smoke health/homepage)
- [ ] Smoke en https://rocha-cotizador.vercel.app tras el release — `GET /api/health` → `{ "ok": true }` + homepage 200

### Smoke test producción

- [ ] `GET https://rocha-cotizador.vercel.app/api/health` → 200
- [ ] Homepage https://rocha-cotizador.vercel.app/ → 200
- [ ] Login admin + cliente (hard refresh si falta sidebar)

- [ ] Cotizar → elegir fecha de entrega (≥ mínimo por corte 16:00 AR) → confirmar → remito muestra Entrega
- [ ] Cotizar → observaciones → confirmar → remito
- [ ] Link remito sin sesión → `/entrar` → admin ve remito
- [ ] WhatsApp `wa.me` abre con datos del pedido (incluye Entrega)
- [ ] Imprimir remito
- [ ] Buscador productos (catálogo) lista resultados

### Ops

- [ ] Neon: saber cómo restaurar / contactar backup del plan
- [ ] Quién mergea a `main` la semana de go-live (una persona)
