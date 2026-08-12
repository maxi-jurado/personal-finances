# CLAUDE.md — Finanzas Personales

App local de un solo usuario para controlar finanzas en 3 monedas (CLP, JPY,
USD). Backend FastAPI + SQLAlchemy + SQLite; frontend React + TS + Tailwind +
Vite; ambos en Docker. Repo también es pieza de portafolio open source.

## Lee esto primero (fuente de verdad)

Antes de tocar código, lee en este orden:

1. **`docs/spec.md`** — spec v1. Alcance (estrictamente 3 monedas), modelo de
   datos, endpoints y las **decisiones D1–D12** (leerlas todas antes de decidir
   nada de diseño).
2. **`tasks/plan.md`** — plan de implementación: 16 tareas en 4 fases con
   checkpoints y riesgos.
3. **`tasks/todo.md`** — estado y detalle de cada tarea. **Es el marcador de
   progreso**: mirá los `[ ]`/`[x]` para saber qué sigue, no confíes en tu
   memoria ni en este archivo para el "dónde vamos".

## Harness de skills (flujo obligatorio)

En `.claude/skills/` está instalado un set curado de Addy Osmani. Usá el flujo
**DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP**, no saltes directo a código:

- Implementar: `incremental-implementation` + `test-driven-development` (slices
  verticales, test → verify → commit por incremento).
- Revisar antes de mergear: `code-review-and-quality`, `code-simplification`,
  `security-and-hardening`.
- Cerrar: `git-workflow-and-versioning`, `shipping-and-launch`.

El CLI `skills` requiere Node ≥22.15 → `source ~/.nvm/nvm.sh && nvm use 22.15.0`
(el default del sistema es Node 20).

## Comandos

**Backend** (desde `backend/`, venv en `backend/.venv`):
```
.venv/bin/python -m pytest            # tests
.venv/bin/python -m uvicorn app.main:app --port 7412   # dev server
.venv/bin/python -m pip install -r requirements.txt
```
Tests fuerzan una SQLite temporal vía `DATABASE_URL` (ver `tests/conftest.py`);
nunca tocan `finanzas.db`.

**Frontend** (desde `frontend/`):
```
npm run build        # tsc --noEmit && vite build
npm run dev          # dev server con proxy /api -> backend
```

**Puertos:** backend **7412**, frontend **7413** (env `BACKEND_PORT` /
`FRONTEND_PORT`). Deliberadamente no convencionales.

## Boundaries (aplican desde siempre)

**Always:** `Decimal`/`Numeric` para dinero (nunca `float`); queries por ORM
parametrizado; validar `currency ∈ {CLP, JPY, USD}` con Pydantic; cachear la API
de tasas 1×/día (nunca por request); correr tests antes de commitear; commits
atómicos por incremento (mensaje termina con la línea `Co-Authored-By`).

**Ask first:** cambiar el schema; agregar/subir dependencias; cambiar puertos,
Docker o CI; ampliar monedas fuera de CLP/JPY/USD.

**Never:** commitear secretos, `.env` real o `*.db`; exponer puertos a la red
(`"7412:7412"` sin `127.0.0.1`); CORS con wildcard `*`; `float` en montos;
interpolar strings en SQL; exponer datos financieros reales (usar
`seed_demo.py`).

## Notas de estado

- Fase 1 (Foundation) completa: scaffolding, capa de datos, servicio de tasas +
  3 conversiones verificadas contra la API real, shell de frontend (Vite 6).
- **Para el estado real y la próxima tarea, consultá `tasks/todo.md`.**
