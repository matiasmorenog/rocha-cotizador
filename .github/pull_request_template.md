## Summary

-

## Test plan

- [ ]

---

## Release PR (`development` → `main`) — mandatory

Only for release PRs. Leave unchecked / delete section on feature PRs.

### Client production

- [ ] **Schema:** if this release changes `prisma/schema.prisma`, ran `prisma db push` against Neon **main** (Production URL / direct host `ep-cool-mud…`), **not** local `.env` — gate must pass before ship
- [ ] Confirmed local `.env` = Neon **development** only (`ep-noisy-darkness…`) — `db push` local does **not** update production
- [ ] `npm run db:check-sync` with Production `DATABASE_URL` is green (or will be gated by Actions pre-deploy)
- [ ] **Admin chrome:** no Tailwind one-off visibility (`hidden lg:block`) for critical UI — sidebar uses `.admin-desktop-sidebar` in `globals.css`
- [ ] Smoke plan after merge: `GET /api/health` → `{ ok: true }` + homepage 200 + admin login (hard refresh if CSS looks wrong)
- [ ] Rollback known: `vercel rollback` / last green Actions redeploy (see `DEPLOY.md`)
