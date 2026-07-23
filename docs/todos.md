# Todos — cambios requeridos

- [x] Observaciones para pedidos (merged en `development` vía #3)
- [x] Disparos de WhatsApp al confirmar cotización (`wa.me`, número configurable en `/admin/configuracion`)
- [ ] Listas de precios corregidas según porcentajes (seleccionar lista)
- [ ] Ajustar precios por cantidad o kg (precios 0 al pedir por cantidad)
- [ ] Vercel Preview: confirmar `DATABASE_URL` → Neon `development` (`ep-noisy-darkness-a6ms81wq-pooler…`), no `main`
- [ ] Local `.env`: apuntar a Neon `development` (direct) — **no** correr seed mientras apunte a prod
- [ ] **Go-live:** passwords seed (admin + PINs clientes) se quedan como están hasta que el admin real diga que go-live está listo. Rotar **recién al último momento** antes del uso real en producción — no cambiar seed ni rotar nada ahora.
