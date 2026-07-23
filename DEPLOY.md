# Deploy — Rocha Cotizador

## Infra (primera producción)

| Pieza | Nombre / URL |
|-------|----------------|
| GitHub | [`matiasmorenog/rocha-cotizador`](https://github.com/matiasmorenog/rocha-cotizador) (privado) |
| Vercel | proyecto `rocha-cotizador` (team `tutemorenos-projects`) → https://rocha-cotizador.vercel.app |
| Neon | proyecto `rocha-cotizador` (org Nexus), región AWS `us-west-2`, DB `neondb` |
| Env | `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` |

## Variables

```bash
# Vercel: Neon pooled + pgbouncer=true&connection_limit=1 (Prisma + serverless = 1 conn/instance)
DATABASE_URL=postgresql://...-pooler...?sslmode=require&pgbouncer=true&connection_limit=1
AUTH_SECRET=                    # openssl rand -base64 32
AUTH_URL=https://rocha-cotizador.vercel.app
```

Setear en Vercel para **Production**, **Preview** y (opcional) **Development**. No commitear `.env`.

### Neon + Prisma (conexiones)

Una sola variable: `DATABASE_URL` (Prisma ya no usa `directUrl` / `DIRECT_URL`).

| Dónde | `DATABASE_URL` recomendada |
|-------|----------------------------|
| **Vercel** | Host **`-pooler`** + `pgbouncer=true&connection_limit=1` |
| **Local** (dev / `db push` / seed) | URL **directa** Neon (sin `-pooler`) o Postgres local |

`prisma db push` contra pooler Neon en transaction mode puede fallar. Si local usás pooler y push falla, cambiá temporalmente:

```bash
DATABASE_URL="postgresql://...@ep-xxx.region.aws.neon.tech/neondb?sslmode=require" npx prisma db push
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

Una vez contra Neon (local con `.env` apuntando a Neon **direct**):

```bash
npx prisma db push
npm run db:seed
```

PINs de clientes: `prisma/data/seed-pins.csv` (gitignored). Entregar PINs a clientes de forma segura.

Admin seed default (constantes en `prisma/seed.ts`): `admin@rocha.com` / `admin1234`. Email vive en DB, no en env. Password se cambia en `/admin/cuenta`.

**Importante:** passwords seed (admin + PINs clientes) se dejan **tal cual** hasta que el admin real confirme que go-live está listo. Rotar admin password y PINs **recién al último momento** antes del uso real en producción — no cambiar seed data ni rotar credenciales ahora.

## Branches

- `development` — integración / preview (default del repo)
- `main` — producción (release PR `development` → `main`; deploy solo vía Actions)

## Checklist go-live (semana de uso real)

- [x] Env en Vercel (Production + Preview + Development)
- [x] `prisma db push` contra Neon
- [x] Seed admin + catálogo
- [ ] Login admin y un cliente de prueba en producción
- [ ] Cotización → remito → imprimir

### Go-live (uso real) — último momento

- [ ] Cambiar password admin (no dejar `admin1234`) en `/admin/cuenta` — solo cuando el admin real diga que go-live está listo
- [ ] Rotar / entregar PINs de clientes por canal seguro — mismo momento; hasta entonces las credenciales seed se quedan como están

### Seguridad / acceso

- [ ] Confirmar `AUTH_SECRET` fuerte y distinto en Production
- [ ] Confirmar `AUTH_URL=https://rocha-cotizador.vercel.app` en Production
- [ ] WhatsApp avisos: número correcto en `/admin/configuracion`

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
