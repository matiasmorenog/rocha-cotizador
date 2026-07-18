# Deploy — Rocha Cotizador

## Infra recomendada

| Pieza | Notas |
|-------|--------|
| Vercel | 1 proyecto |
| Neon / Postgres | 1 DB |
| Env | `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` |

## Variables

```bash
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...   # Neon: connection string no-pooled
AUTH_SECRET=                     # openssl rand -base64 32
AUTH_URL=https://tu-dominio.vercel.app
ADMIN_EMAIL=admin@tu-dominio.com
ADMIN_PASSWORD=                  # solo para seed / bootstrap admin
```

Build command (Vercel): `prisma generate && next build` (o el script `npm run build`).

## Seed en producción

Correr una vez con el Excel en `prisma/data/rocha_data.xlsx`:

```bash
npm run db:seed
```

Guardar `prisma/data/seed-pins.csv` de forma segura (no subir a git) y entregar PINs a clientes.

## Branches

- `development` — integración / preview
- `main` — producción (solo vía release PR)

## Checklist

- [ ] Env en Vercel (Production + Preview)
- [ ] `prisma db push` o migrate contra Neon
- [ ] Seed admin + catálogo
- [ ] Login admin y un cliente de prueba
- [ ] Cotización → remito → imprimir
