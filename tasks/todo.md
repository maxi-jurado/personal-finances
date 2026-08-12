# Task List: Finanzas Personales v1

> Detalle de tareas para Phase 4 (Implement). Cada tarea es S/M (≤5 archivos),
> con criterios de aceptación y verificación. Órden = dependencias.
> Comandos: backend `pytest` · frontend `npm run build` / `npm run test` · todo
> junto `docker-compose up`.

---

## Phase 1 — Foundation

## Task 1: Scaffolding del repo
**Description:** Crear la estructura de carpetas del spec, `.gitignore`,
`.env.example`, `requirements.txt` y el esqueleto de dependencias. Base segura
antes de escribir lógica.

**Acceptance criteria:**
- [ ] Estructura `backend/app/{routers,services}`, `backend/{scripts,tests}`, `frontend/src/{components,pages,api}` existe
- [ ] `.gitignore` incluye `*.db *.sqlite *.sqlite3 .env __pycache__/ node_modules/`
- [ ] `.env.example` documenta `BACKEND_PORT=7412`, `FRONTEND_PORT=7413`

**Verification:**
- [ ] `git status` no muestra `.env` ni `*.db` como trackeables
- [ ] Manual: árbol de carpetas coincide con el spec

**Dependencies:** None
**Files:** `.gitignore`, `.env.example`, `backend/requirements.txt`, dirs
**Scope:** M

## Task 2: Capa de datos backend
**Description:** `database.py` (engine/session, crea schema si `finanzas.db` no
existe), `models.py` (todas las tablas + enum `Currency`), seed de las 2
`credit_cards` (Tarjeta 1 / Tarjeta 2) al inicializar. Montos con `Numeric`.

**Acceptance criteria:**
- [ ] Todas las tablas del spec creadas vía ORM; montos `Numeric`, no `Float`
- [ ] `Currency` enum restringe a {CLP, JPY, USD}
- [ ] Al primer arranque se crean exactamente 2 filas en `credit_cards`

**Verification:**
- [ ] `pytest` de creación de schema en SQLite temporal pasa
- [ ] Manual: arrancar backend crea `finanzas.db` con las tablas

**Dependencies:** Task 1
**Files:** `backend/app/database.py`, `backend/app/models.py`, `backend/app/schemas.py`
**Scope:** M

## Task 3: Servicio de tipo de cambio
**Description:** `services/exchange_rates.py` que hace fetch a
`open.er-api.com/v6/latest/USD`, cachea en `exchange_rates` 1×/día, y expone
helpers de conversión para CLP↔JPY, USD↔JPY, USD↔CLP. Endpoint
`GET /api/exchange-rates/latest`. Si el fetch falla, sirve la última tasa cacheada.

**Acceptance criteria:**
- [ ] No se llama la API si ya hay tasa del día en cache
- [ ] Las 3 conversiones se derivan de la respuesta base USD
- [ ] `GET /api/exchange-rates/latest` devuelve las tasas vigentes

**Verification:**
- [ ] `pytest` de conversiones con fixture (sin red) pasa
- [ ] Manual: 1ª llamada puebla cache, 2ª no re-llama la API

**Dependencies:** Task 2
**Files:** `backend/app/services/exchange_rates.py`, `backend/app/routers/exchange_rates.py`, `backend/app/main.py`
**Scope:** M

## Task 4: Scaffolding frontend
**Description:** Proyecto Vite + React 18 + TS + Tailwind, cliente API central
en `src/api/`, app shell con routing y detección de estado de config.

**Acceptance criteria:**
- [ ] `npm run build` compila sin errores de TS
- [ ] Cliente API tipado apunta a `/api` (proxy)
- [ ] Tailwind aplica estilos en el shell

**Verification:**
- [ ] `npm run build` OK
- [ ] Manual: `npm run dev` renderiza el shell

**Dependencies:** Task 1
**Files:** `frontend/{package.json,vite.config.ts,tailwind.config.js}`, `frontend/src/{main.tsx,App.tsx,api/client.ts}`
**Scope:** M

### Checkpoint: Foundation → review con el humano

---

## Phase 2 — Primer arranque + CRUD

## Task 5: Config + wizard (slice vertical)
**Description:** Backend `GET/POST /api/config` (flag `configured`); frontend
wizard de un paso con checkboxes CLP/JPY/USD (mín. 2), guarda y redirige al
dashboard. Si ya está configurado, se salta siempre.

**Acceptance criteria:**
- [ ] `GET /api/config` sin config → `{"configured": false}`
- [ ] Wizard exige ≥2 monedas y solo permite CLP/JPY/USD
- [ ] Tras `POST`, no reaparece el wizard

**Verification:**
- [ ] `pytest` de config (sin/una/con config) pasa
- [ ] Manual: DB fresca → wizard → dashboard; recarga no vuelve al wizard

**Dependencies:** Tasks 2, 4
**Files:** `backend/app/routers/config.py`, `backend/app/schemas.py`, `frontend/src/pages/Wizard.tsx`, `frontend/src/api/config.ts`
**Scope:** M

## Task 6: Income (slice vertical)
**Description:** `GET/POST /api/income` + form y tabla en frontend. Soporta las 3
monedas (D10).

**Acceptance criteria:**
- [ ] Se crea income en CLP, JPY o USD y aparece en la lista
- [ ] Validación de moneda y monto (`Decimal`)

**Verification:**
- [ ] `pytest` de income CRUD pasa
- [ ] Manual: crear y ver un ingreso USD desde la UI

**Dependencies:** Task 5
**Files:** `backend/app/routers/income.py`, `frontend/src/pages/Income.tsx`, `frontend/src/api/income.ts`
**Scope:** M

## Task 7: Card-expenses (slice vertical)
**Description:** `GET/POST /api/card-expenses/{card_id}` (montos en CLP) + UI para
las 2 tarjetas.

**Acceptance criteria:**
- [ ] Se registra gasto contra `card_id` válido; `amount_clp` en CLP
- [ ] `card_id` inexistente → 404

**Verification:**
- [ ] `pytest` de card-expenses pasa
- [ ] Manual: agregar gasto a Tarjeta 1 y Tarjeta 2

**Dependencies:** Task 5
**Files:** `backend/app/routers/card_expenses.py`, `frontend/src/pages/CardExpenses.tsx`, `frontend/src/api/cardExpenses.ts`
**Scope:** M

## Task 8: Monthly-expenses (slice vertical)
**Description:** `GET/POST /api/monthly-expenses` + UI. Aquí se registra la recarga
ICOCA como gasto (D12).

**Acceptance criteria:**
- [ ] Se crea gasto mensual en cualquiera de las 3 monedas
- [ ] Categoría texto libre (D2)

**Verification:**
- [ ] `pytest` de monthly-expenses pasa
- [ ] Manual: crear gasto "ICOCA" en JPY

**Dependencies:** Task 5
**Files:** `backend/app/routers/monthly_expenses.py`, `frontend/src/pages/MonthlyExpenses.tsx`, `frontend/src/api/monthlyExpenses.ts`
**Scope:** M

## Task 9: Fixed-expenses (slice vertical)
**Description:** `GET/POST /api/fixed-expenses` (concept, currency, amount,
payment_day) + UI.

**Acceptance criteria:**
- [ ] Se crea gasto fijo con `payment_day` 1–31
- [ ] Moneda restringida a {CLP, JPY, USD}

**Verification:**
- [ ] `pytest` de fixed-expenses pasa
- [ ] Manual: crear "Arriendo" en JPY

**Dependencies:** Task 5
**Files:** `backend/app/routers/fixed_expenses.py`, `frontend/src/pages/FixedExpenses.tsx`, `frontend/src/api/fixedExpenses.ts`
**Scope:** M

## Task 10: Transfers (slice vertical)
**Description:** `GET/POST /api/transfers`; `effective_rate = clp_charged /
jpy_requested` calculado en la app (D6) + UI.

**Acceptance criteria:**
- [ ] `effective_rate` se computa, no se ingresa
- [ ] `jpy_requested = 0` no rompe (validación / rechazo)

**Verification:**
- [ ] `pytest` de `effective_rate` pasa
- [ ] Manual: crear giro y ver la tasa efectiva

**Dependencies:** Task 5
**Files:** `backend/app/routers/transfers.py`, `frontend/src/pages/Transfers.tsx`, `frontend/src/api/transfers.ts`
**Scope:** M

### Checkpoint: CRUD → `pytest` verde, cada entidad usable

---

## Phase 3 — Consolidación

## Task 11: Summary endpoint
**Description:** `GET /api/summary?month=YYYY-MM`: agrega ingresos − gastos
(mensuales + fijos + tarjeta + giros) del mes y los expresa en las 3 monedas
usando la última tasa cacheada (D1).

**Acceptance criteria:**
- [ ] Devuelve balance del mes en CLP, JPY y USD
- [ ] `month` inválido → 422; mes sin datos → ceros

**Verification:**
- [ ] `pytest` de summary con datos sembrados pasa
- [ ] Manual: `?month=` de un mes con datos da números coherentes

**Dependencies:** Tasks 3, 6–10
**Files:** `backend/app/routers/summary.py`, `backend/app/services/summary.py`, `backend/tests/test_summary.py`
**Scope:** M

## Task 12: Dashboard
**Description:** Página de dashboard del mes actual (D9): tarjetas de saldo en las
3 monedas coloreadas verde/rojo (D11), deuda de cada tarjeta (roja), y tablas de
movimientos del mes.

**Acceptance criteria:**
- [ ] Saldo positivo en verde, negativo en rojo, en las 3 monedas
- [ ] Deuda de tarjetas mostrada aparte, en rojo
- [ ] Vista abre en el mes en curso

**Verification:**
- [ ] `npm run build` OK
- [ ] Manual: con seed, el dashboard muestra colores y montos correctos

**Dependencies:** Task 11
**Files:** `frontend/src/pages/Dashboard.tsx`, `frontend/src/components/BalanceCard.tsx`, `frontend/src/api/summary.ts`
**Scope:** M

### Checkpoint: Consolidación → balance correcto y coloreado

---

## Phase 4 — Calidad y ship

## Task 13: seed_demo.py
**Description:** Script que puebla ~4–6 meses de datos ficticios realistas
(ingresos, gastos de tarjeta/mensuales/fijos, giros, tasas) sin exponer datos
reales.

**Acceptance criteria:**
- [ ] Corre idempotente sobre DB limpia y deja la app usable como demo
- [ ] Datos repartidos en varios meses (D8)

**Verification:**
- [ ] `python scripts/seed_demo.py` sin errores; dashboard y summary poblados
- [ ] Manual: revisar realismo de montos/categorías

**Dependencies:** Tasks 6–11
**Files:** `backend/scripts/seed_demo.py`
**Scope:** M

## Task 14: Tests backend
**Description:** Suite `pytest` priorizando las 3 conversiones, `effective_rate`,
`/api/summary` y el flujo de config/wizard. SQLite temporal, nunca la DB real.

**Acceptance criteria:**
- [ ] Cubre conversiones, effective_rate, summary, config
- [ ] No toca red ni `finanzas.db`

**Verification:**
- [ ] `pytest` verde
- [ ] Manual: revisar cobertura de los 4 focos

**Dependencies:** Tasks 3, 5, 10, 11
**Files:** `backend/tests/{conftest.py,test_exchange_rates.py,test_transfers.py,test_summary.py,test_config.py}`
**Scope:** M

## Task 15: Dockerización
**Description:** `backend/Dockerfile`, `frontend/Dockerfile` (build Vite + nginx
con proxy `/api`→backend), `docker-compose.yml` con binds `127.0.0.1:7412` y
`127.0.0.1:7413`, CORS al origin exacto, puertos por env.

**Acceptance criteria:**
- [ ] `docker-compose up` levanta ambos sin pasos manuales
- [ ] Mapeo `127.0.0.1:...`, nunca `"7412:7412"`; CORS = `http://localhost:7413`

**Verification:**
- [ ] `docker-compose up` y app accesible en `localhost:7413`
- [ ] Manual: `docker compose config` muestra binds a `127.0.0.1`

**Dependencies:** Tasks 3, 12
**Files:** `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `docker-compose.yml`
**Scope:** M

## Task 16: README + docs
**Description:** README con qué hace, capturas, `docker-compose up`, variables de
entorno, y nota explícita sobre `seed_demo.py` (no expone datos reales).
`.env.example` final. Si alcanza, tests Vitest de conversión/formateo.

**Acceptance criteria:**
- [ ] README cubre los 5 puntos del spec (qué hace, capturas, levantar, env, seed)
- [ ] `.env.example` documentado y sin secretos

**Verification:**
- [ ] Manual: seguir el README desde cero levanta la app
- [ ] (Opcional) `npm run test` verde

**Dependencies:** Tasks 12, 13, 15
**Files:** `README.md`, `.env.example`, `frontend/src/**/*.test.tsx` (opcional)
**Scope:** M

### Checkpoint: Complete → `docker-compose up` OK, criterios del spec cumplidos
