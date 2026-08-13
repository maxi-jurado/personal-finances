# Implementation Plan: Finanzas Personales (CLP / JPY / USD)

> Salida de Phase 2 (`planning-and-task-breakdown`). Deriva de `docs/spec.md`
> (decisiones D1–D12). Documento vivo: se actualiza si cambian decisiones.

## Overview

App local de un solo usuario para controlar finanzas en 3 monedas (CLP, JPY,
USD). Backend FastAPI + SQLAlchemy + SQLite; frontend React 18 + TS + Tailwind +
Vite; ambos en Docker vía docker-compose (puertos 7412 / 7413, bind a
`127.0.0.1`). Se construye de abajo hacia arriba (schema → servicios → API →
frontend), con slices verticales por entidad y checkpoints entre fases.

## Architecture Decisions

- **Foundation-first + slices verticales:** el modelo de datos y el scaffolding
  son compartidos, así que van primero (Fase 1). Luego cada entidad
  (income, card-expenses, monthly, fixed, transfers) es un slice vertical
  backend→frontend (Fase 2).
- **Conversión centralizada:** un único servicio `exchange_rates.py` cachea la
  respuesta USD-base 1×/día (D5) y expone helpers de conversión para los 3 pares.
  El summary usa la última tasa cacheada (D1).
- **Sin modelo de cuentas:** saldos derivados del flujo ingresos − gastos (D11);
  la ICOCA es un gasto más (D12). El schema queda igual al del brief.
- **Precisión:** `Numeric`/`Decimal` en todo monto (D4), `Currency` como enum
  restringido a {CLP, JPY, USD}.
- **Seguridad desde T1:** `.gitignore` (`*.db`, `.env`…), CORS al origin exacto,
  binds `127.0.0.1`, ORM parametrizado, sin secretos.

## Dependency Graph

```
scaffolding (.gitignore, requirements, vite)
    │
    ├── models + Currency enum + db auto-create ──┐
    │        │                                     │
    │        ├── exchange_rates service + endpoint │
    │        │        │                            │
    │        │        └── /api/summary ────────────┤
    │        │                                     │
    │        └── CRUD routers (income, cards,       │
    │             monthly, fixed, transfers) ──────┤
    │                                              │
    └── frontend shell + API client ──────────────┴── wizard, forms, dashboard
```

## Task List

### Phase 1: Foundation
- [ ] Task 1: Scaffolding del repo (estructura, `.gitignore`, `.env.example`)
- [ ] Task 2: Capa de datos backend (models, Currency enum, auto-create, 2 cards)
- [ ] Task 3: Servicio de tipo de cambio + endpoint + helpers de conversión
- [ ] Task 4: Scaffolding frontend (Vite/TS/Tailwind, API client, app shell)

### Checkpoint: Foundation
- [ ] `uvicorn` levanta y crea `finanzas.db`; `GET /api/exchange-rates/latest` responde
- [ ] `npm run build` compila; app shell carga
- [ ] Review con el humano antes de seguir

### Phase 2: Primer arranque + CRUD por entidad
- [ ] Task 5: Config + wizard (backend `/api/config` + UI de un paso + redirect)
- [ ] Task 6: Income (router + schema + form/tabla)
- [ ] Task 7: Card-expenses `/api/card-expenses/{card_id}` (2 tarjetas)
- [ ] Task 8: Monthly-expenses
- [ ] Task 9: Fixed-expenses
- [ ] Task 10: Transfers (con `effective_rate` calculado)

### Checkpoint: CRUD
- [ ] Wizard funciona end-to-end; no reaparece tras configurar
- [ ] Se puede crear/listar cada entidad desde la UI
- [ ] `pytest` verde en lo implementado

### Phase 3: Consolidación
- [ ] Task 11: `GET /api/summary?month=` (ingresos − gastos por moneda, tasa cacheada)
- [ ] Task 12: Dashboard (tarjetas verde/rojo en 3 monedas, deuda de tarjetas, tablas del mes)

### Checkpoint: Consolidación
- [ ] Balance del mes correcto en las 3 monedas
- [ ] Saldo positivo verde / negativo rojo; deuda de tarjeta en rojo

### Phase 4: Calidad y ship
- [ ] Task 13: `seed_demo.py` (~4–6 meses de datos ficticios realistas)
- [ ] Task 14: Tests backend (3 conversiones, `effective_rate`, summary, config)
- [ ] Task 15: Dockerización (2 Dockerfiles + `docker-compose.yml`, binds `127.0.0.1`, CORS)
- [ ] Task 16: README + `.env.example` doc + (si alcanza) tests Vitest

### Checkpoint: Complete
- [ ] `docker-compose up` levanta ambos servicios sin pasos manuales
- [ ] Todos los criterios de éxito del spec cumplidos
- [ ] Listo para review (`code-review-and-quality`) y ship

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API `open.er-api.com` caída o rate-limit | Med | Cache diario (D5); si falla el fetch, servir última tasa cacheada y loguear; test con fixture, no red real |
| `float` colándose en montos | High | `Decimal`/`Numeric` desde T2; test de redondeo; regla en Boundaries |
| Puerto expuesto a la red (`"7412:7412"`) | High | Bind `127.0.0.1` explícito en compose (T15); revisar en `security-and-hardening` |
| CORS wildcard | Med | Origin exacto `http://localhost:7413` desde T1/T15 |
| Scope creep (cuentas, histórico, charts) | Med | Diferido explícitamente por D7/D9/D11/D12; no implementar |
| Node 20 local vs. tooling que pide 22 | Low | Docker usa su propia imagen Node; dev local con `nvm use 22.15` si hace falta |

## Open Questions

- Ninguna. Las decisiones abiertas se resolvieron en el spec (D1–D12).
