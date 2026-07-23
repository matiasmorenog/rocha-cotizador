# Todos — cambios requeridos

- [x] Observaciones para pedidos (merged en `development` vía #3)
- [x] Disparos de WhatsApp al confirmar cotización (`wa.me`, número configurable en `/admin/configuracion`)
- [ ] Listas de precios corregidas según porcentajes (seleccionar lista)
- [ ] Ajustar precios por cantidad o kg (precios 0 al pedir por cantidad)
- [x] Vercel Preview ≡ Development: **todas** las env vars (incl. `DATABASE_URL` → Neon `development` pooler, `AUTH_*`); Production aislado (`main`)
- [x] Local `.env`: Neon `development` (direct) + `SEED_TARGET=development` — **no** seed contra prod
- [ ] **Go-live:** passwords seed (admin + PINs clientes) se quedan como están hasta que el admin real diga que go-live está listo. Rotar **recién al último momento** antes del uso real en producción — no cambiar seed ni rotar nada ahora.
