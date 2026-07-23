# Deploy — Rocha Cotizador

## Infra (primera producción)

| Pieza | Nombre / URL |
|-------|----------------|
| GitHub | [`matiasmorenog/rocha-cotizador`](https://github.com/matiasmorenog/rocha-cotizador) (privado) |
| Vercel | proyecto `rocha-cotizador` (team `tutemorenos-projects`) → https://rocha-cotizador.vercel.app |
| Neon | proyecto `rocha-cotizador` (org Nexus), región AWS `us-west-2`, DB `neondb` |
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

## Seed

Una vez contra Neon **`development`** (local `.env` = URL **direct** de ese branch). Nunca `db push` / seed contra Neon `main` desde local salvo release consciente:

```bash
npx prisma db push
npm run db:seed
```

PINs de clientes: `prisma/data/seed-pins.csv` (gitignored). Entregar PINs a clientes de forma segura.

Admin seed default (constantes en `prisma/seed.ts`): `admin@rocha.com` / `admin1234` — cambiar password tras primer login. Email vive en DB, no en env.

## Branches (Git)

- `development` — integración / preview (default del repo); misma DB Neon `development`
- `main` — producción (Vercel Production branch; releases vía PR `development` → `main`); DB Neon `main`

## Checklist

- [x] Env Vercel: Production → Neon `main`; Preview → Neon `development`
- [x] Branch Neon `development` (copia de `main`; permanente; no TTL)
- [x] Seed admin + catálogo (en Neon `main` al go-live; re-seed `development` si hace falta)
- [ ] Login admin y un cliente de prueba en producción
- [ ] Cotización → remito → imprimir
- [ ] Local `.env` apunta a Neon `development` (direct)
