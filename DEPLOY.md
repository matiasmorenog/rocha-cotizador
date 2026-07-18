# Deploy — Rocha Cotizador

## Infra (primera producción)

| Pieza | Nombre / URL |
|-------|----------------|
| GitHub | [`matiasmorenog/rocha-cotizador`](https://github.com/matiasmorenog/rocha-cotizador) (privado) |
| Vercel | proyecto `rocha-cotizador` (team `tutemorenos-projects`) → https://rocha-cotizador.vercel.app |
| Neon | proyecto `rocha-cotizador` (org Nexus), región AWS `us-west-2`, DB `neondb` |
| Env | `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` |

## Variables

```bash
DATABASE_URL=postgresql://...   # Neon pooled (-pooler)
DIRECT_URL=postgresql://...     # Neon direct (sin -pooler)
AUTH_SECRET=                    # openssl rand -base64 32
AUTH_URL=https://rocha-cotizador.vercel.app
ADMIN_EMAIL=admin@rocha.local
ADMIN_PASSWORD=                 # solo para seed / bootstrap admin
```

Setear en Vercel para **Production**, **Preview** y (opcional) **Development**. No commitear `.env`.

Build command (Vercel): `npm run build` → `prisma generate && next build` (`postinstall` también corre `prisma generate`).

## Seed

Una vez contra Neon (local con `.env` apuntando a Neon):

```bash
npx prisma db push
npm run db:seed
```

PINs de clientes: `prisma/data/seed-pins.csv` (gitignored). Entregar PINs a clientes de forma segura.

Admin seed default: `admin@rocha.local` / ver `ADMIN_PASSWORD` en Vercel o `.env.example`.

## Branches

- `development` — integración / preview (default del repo)
- `main` — producción (Vercel Production branch; releases vía PR `development` → `main`)

## Checklist

- [x] Env en Vercel (Production + Preview + Development)
- [x] `prisma db push` contra Neon
- [x] Seed admin + catálogo
- [ ] Login admin y un cliente de prueba en producción
- [ ] Cotización → remito → imprimir
