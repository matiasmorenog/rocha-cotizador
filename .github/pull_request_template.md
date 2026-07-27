## Summary

-

## Test plan

- [ ]

---

## Release PR (`development` → `main`) — mandatory

Only for release PRs. Leave unchecked / delete section on feature PRs.

- [ ] **Schema:** if this release changes `prisma/schema.prisma`, ran `prisma db push` against Neon **main** (Production URL / direct host `ep-cool-mud…`), **not** local `.env`
- [ ] Confirmed local `.env` = Neon **development** only (`ep-noisy-darkness…`) — `db push` local does **not** update production
- [ ] `npm run db:check-sync` with Production `DATABASE_URL` is green (or will be gated by Actions pre-deploy)
- [ ] Smoke plan after merge: `GET /api/health` → `{ ok: true }` + admin login
