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
- [x] Estructura `backend/app/{routers,services}`, `backend/{scripts,tests}`, `frontend/src/{components,pages,api}` existe
- [x] `.gitignore` incluye `*.db *.sqlite *.sqlite3 .env __pycache__/ node_modules/`
- [x] `.env.example` documenta `BACKEND_PORT=7412`, `FRONTEND_PORT=7413`

**Verification:**
- [x] `git status` no muestra `.env` ni `*.db` como trackeables
- [x] Manual: árbol de carpetas coincide con el spec

**Dependencies:** None
**Files:** `.gitignore`, `.env.example`, `backend/requirements.txt`, dirs
**Scope:** M

## Task 2: Capa de datos backend
**Description:** `database.py` (engine/session, crea schema si `finanzas.db` no
existe), `models.py` (todas las tablas + enum `Currency`), seed de las 2
`credit_cards` (Tarjeta 1 / Tarjeta 2) al inicializar. Montos con `Numeric`.

**Acceptance criteria:**
- [x] Todas las tablas del spec creadas vía ORM; montos `Numeric`, no `Float`
- [x] `Currency` enum restringe a {CLP, JPY, USD}
- [x] Al primer arranque se crean exactamente 2 filas en `credit_cards`

**Verification:**
- [x] `pytest` de creación de schema en SQLite temporal pasa
- [x] Manual: arrancar backend crea `finanzas.db` con las tablas

**Dependencies:** Task 1
**Files:** `backend/app/database.py`, `backend/app/models.py`, `backend/app/schemas.py`
**Scope:** M

## Task 3: Servicio de tipo de cambio
**Description:** `services/exchange_rates.py` que hace fetch a
`open.er-api.com/v6/latest/USD`, cachea en `exchange_rates` 1×/día, y expone
helpers de conversión para CLP↔JPY, USD↔JPY, USD↔CLP. Endpoint
`GET /api/exchange-rates/latest`. Si el fetch falla, sirve la última tasa cacheada.

**Acceptance criteria:**
- [x] No se llama la API si ya hay tasa del día en cache
- [x] Las 3 conversiones se derivan de la respuesta base USD
- [x] `GET /api/exchange-rates/latest` devuelve las tasas vigentes

**Verification:**
- [x] `pytest` de conversiones con fixture (sin red) pasa
- [x] Manual: 1ª llamada puebla cache, 2ª no re-llama la API

**Dependencies:** Task 2
**Files:** `backend/app/services/exchange_rates.py`, `backend/app/routers/exchange_rates.py`, `backend/app/main.py`
**Scope:** M

## Task 4: Scaffolding frontend
**Description:** Proyecto Vite + React 18 + TS + Tailwind, cliente API central
en `src/api/`, app shell con routing y detección de estado de config.

**Acceptance criteria:**
- [x] `npm run build` compila sin errores de TS
- [x] Cliente API tipado apunta a `/api` (proxy)
- [x] Tailwind aplica estilos en el shell

**Verification:**
- [x] `npm run build` OK
- [x] Manual: `npm run dev` renderiza el shell

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
- [x] `GET /api/config` sin config → `{"configured": false}`
- [x] Wizard exige ≥2 monedas y solo permite CLP/JPY/USD
- [x] Tras `POST`, no reaparece el wizard

**Verification:**
- [x] `pytest` de config (sin/una/con config) pasa
- [x] Manual: DB fresca → wizard → dashboard; recarga no vuelve al wizard

**Dependencies:** Tasks 2, 4
**Files:** `backend/app/routers/config.py`, `backend/app/schemas.py`, `frontend/src/pages/Wizard.tsx`, `frontend/src/api/config.ts`
**Scope:** M

## Task 6: Income (slice vertical)
**Description:** `GET/POST /api/income` + form y tabla en frontend. Soporta las 3
monedas (D10).

**Acceptance criteria:**
- [x] Se crea income en CLP, JPY o USD y aparece en la lista
- [x] Validación de moneda y monto (`Decimal`)

**Verification:**
- [x] `pytest` de income CRUD pasa
- [x] Manual: crear y ver un ingreso USD desde la UI

**Dependencies:** Task 5
**Files:** `backend/app/routers/income.py`, `frontend/src/pages/Income.tsx`, `frontend/src/api/income.ts`
**Scope:** M

## Task 7: Card-expenses (slice vertical)
**Description:** `GET/POST /api/card-expenses/{card_id}` (montos en CLP) + UI para
las 2 tarjetas.

**Acceptance criteria:**
- [x] Se registra gasto contra `card_id` válido; `amount_clp` en CLP
- [x] `card_id` inexistente → 404

**Verification:**
- [x] `pytest` de card-expenses pasa
- [x] Manual: agregar gasto a Tarjeta 1 y Tarjeta 2

**Dependencies:** Task 5
**Files:** `backend/app/routers/card_expenses.py`, `frontend/src/pages/CardExpenses.tsx`, `frontend/src/api/cardExpenses.ts`
**Scope:** M

## Task 8: Monthly-expenses (slice vertical)
**Description:** `GET/POST /api/monthly-expenses` + UI. Aquí se registra la recarga
ICOCA como gasto (D12).

**Acceptance criteria:**
- [x] Se crea gasto mensual en cualquiera de las 3 monedas
- [x] Categoría texto libre (D2)

**Verification:**
- [x] `pytest` de monthly-expenses pasa
- [x] Manual: crear gasto "ICOCA" en JPY

**Dependencies:** Task 5
**Files:** `backend/app/routers/monthly_expenses.py`, `frontend/src/pages/MonthlyExpenses.tsx`, `frontend/src/api/monthlyExpenses.ts`
**Scope:** M

## Task 9: Fixed-expenses (slice vertical)
**Description:** `GET/POST /api/fixed-expenses` (concept, currency, amount,
payment_day) + UI.

**Acceptance criteria:**
- [x] Se crea gasto fijo con `payment_day` 1–31
- [x] Moneda restringida a {CLP, JPY, USD}

**Verification:**
- [x] `pytest` de fixed-expenses pasa
- [x] Manual: crear "Arriendo" en JPY

**Dependencies:** Task 5
**Files:** `backend/app/routers/fixed_expenses.py`, `frontend/src/pages/FixedExpenses.tsx`, `frontend/src/api/fixedExpenses.ts`
**Scope:** M

## Task 10: Transfers (slice vertical)
**Description:** `GET/POST /api/transfers`; `effective_rate = clp_charged /
jpy_requested` calculado en la app (D6) + UI.

**Acceptance criteria:**
- [x] `effective_rate` se computa, no se ingresa
- [x] `jpy_requested = 0` no rompe (validación / rechazo)

**Verification:**
- [x] `pytest` de `effective_rate` pasa
- [x] Manual: crear giro y ver la tasa efectiva

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
- [x] Devuelve balance del mes en CLP, JPY y USD
- [x] `month` inválido → 422; mes sin datos → ceros

**Verification:**
- [x] `pytest` de summary con datos sembrados pasa
- [x] Manual: `?month=` de un mes con datos da números coherentes

**Dependencies:** Tasks 3, 6–10
**Files:** `backend/app/routers/summary.py`, `backend/app/services/summary.py`, `backend/tests/test_summary.py`
**Scope:** M

## Task 12: Dashboard
**Description:** Página de dashboard del mes actual (D9): tarjetas de saldo en las
3 monedas coloreadas verde/rojo (D11), deuda de cada tarjeta (roja), y tablas de
movimientos del mes.

**Acceptance criteria:**
- [x] Saldo positivo en verde, negativo en rojo, en las 3 monedas
- [x] Deuda de tarjetas mostrada aparte, en rojo
- [x] Vista abre en el mes en curso

**Verification:**
- [x] `npm run build` OK
- [ ] Manual: con seed, el dashboard muestra colores y montos correctos (pendiente: requiere seed_demo, Task 13)

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
- [x] Corre idempotente sobre DB limpia y deja la app usable como demo
- [x] Datos repartidos en varios meses (D8)

**Verification:**
- [x] `python scripts/seed_demo.py` sin errores; dashboard y summary poblados
- [x] Manual: revisar realismo de montos/categorías

**Dependencies:** Tasks 6–11
**Files:** `backend/scripts/seed_demo.py`
**Scope:** M

## Task 14: Tests backend
**Description:** Suite `pytest` priorizando las 3 conversiones, `effective_rate`,
`/api/summary` y el flujo de config/wizard. SQLite temporal, nunca la DB real.

**Acceptance criteria:**
- [x] Cubre conversiones, effective_rate, summary, config
- [x] No toca red ni `finanzas.db`

**Verification:**
- [x] `pytest` verde (67 tests)
- [x] Manual: revisar cobertura de los 4 focos

**Dependencies:** Tasks 3, 5, 10, 11
**Files:** `backend/tests/{conftest.py,test_exchange_rates.py,test_transfers.py,test_summary.py,test_config.py}`
**Scope:** M

## Task 15: Dockerización
**Description:** `backend/Dockerfile`, `frontend/Dockerfile` (build Vite + nginx
con proxy `/api`→backend), `docker-compose.yml` con binds `127.0.0.1:7412` y
`127.0.0.1:7413`, CORS al origin exacto, puertos por env.

**Acceptance criteria:**
- [x] `docker-compose up` levanta ambos sin pasos manuales (frontend depende del healthcheck del backend)
- [x] Mapeo `127.0.0.1:...`, nunca `"7412:7412"`; CORS = `http://localhost:7413`

**Verification:**
- [x] `docker-compose up` y app accesible en `localhost:7413` (verificado en vivo vía `deploy.sh`: frontend 200, API por nginx OK, summary poblado)
- [x] Manual: `docker compose config` muestra binds a `127.0.0.1`

**Dependencies:** Tasks 3, 12
**Files:** `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `docker-compose.yml`
**Scope:** M

## Task 16: README + docs
**Description:** README con qué hace, capturas, `docker-compose up`, variables de
entorno, y nota explícita sobre `seed_demo.py` (no expone datos reales).
`.env.example` final. Si alcanza, tests Vitest de conversión/formateo.

**Acceptance criteria:**
- [x] README cubre los 5 puntos del spec (qué hace, capturas, levantar, env, seed)
      — capturas: sección lista con instrucciones; falta pegar los 2 PNG en docs/img/
- [x] `.env.example` documentado y sin secretos

**Verification:**
- [x] Manual: el README refleja el flujo real (deploy.sh verificado en vivo)
- [ ] (Opcional) `npm run test` verde — Vitest no configurado (diferido)

**Dependencies:** Tasks 12, 13, 15
**Files:** `README.md`, `.env.example`, `frontend/src/**/*.test.tsx` (opcional)
**Scope:** M

### Checkpoint: Complete → `docker-compose up` OK, criterios del spec cumplidos

---

## Phase 5 — Categorías, estado de gastos, tarjetas y filtros

> Ampliación post-v1 (D15–D18 en `docs/spec.md`): estado en vez de delete en
> gastos mensuales, tabla real de categorías, gestión completa de tarjetas
> (currency/cupo/pagos, sin límite de cantidad) y filtros combinables. Requirió
> introducir Alembic (el proyecto solo tenía `create_all()`, que no altera
> tablas existentes).

## Task 17: Alembic (infra)
**Description:** Introducir migraciones de schema. Baseline que reproduce el
schema de v1 tal cual, para no perder el `finanzas.db` local ya existente.

**Acceptance criteria:**
- [x] `alembic upgrade head` desde vacío reproduce el schema de `Base.metadata`
- [x] Migraciones corren en el entrypoint de Docker, no en el `lifespan` de
      FastAPI (tests siguen usando `create_all()` directo)
- [x] Fallback de `stamp` a la baseline para el `finanzas.db` local pre-Alembic

**Verification:**
- [x] `pytest` verde (incluye `test_migrations.py`, nuevo)
- [x] Manual: migración probada contra datos legacy reales (tarjeta + gasto)

**Dependencies:** None
**Files:** `backend/alembic/`, `backend/alembic.ini`, `backend/requirements.txt`, `backend/Dockerfile`, `backend/tests/test_migrations.py`
**Scope:** M

## Task 18: Categorías backend
**Description:** Tabla `categories` con CRUD completo (crear/listar/editar/borrar).

**Acceptance criteria:**
- [x] Nombre único; 409 si duplicado
- [x] `DELETE` bloqueado (409) si la categoría está en uso — implementado en
      Task 19, una vez existe la FK que la referencia

**Verification:**
- [x] `pytest` verde

**Dependencies:** Task 17
**Files:** `backend/app/models.py`, `backend/app/routers/categories.py`, `backend/app/schemas.py`, `backend/alembic/versions/0002_categories.py`, `backend/tests/test_categories.py`
**Scope:** M

## Task 19: Categorías FK en gastos
**Description:** `monthly_expenses`/`card_expenses.category` (texto libre, D2)
pasa a `category_id` FK. Backfill lookup-or-create desde los strings
existentes antes de dropear la columna vieja.

**Acceptance criteria:**
- [x] Migración con backfill probada con datos reales pre-existentes
- [x] `category_id` inválido → 404 al crear un gasto
- [x] `DELETE /api/categories/{id}` → 409 si está en uso

**Verification:**
- [x] `pytest` verde

**Dependencies:** Task 18
**Files:** `backend/app/models.py`, `backend/app/routers/monthly_expenses.py`, `backend/app/routers/card_expenses.py`, `backend/app/routers/categories.py`, `backend/alembic/versions/0003_*.py`, `0004_*.py`, `backend/scripts/seed_demo.py`
**Scope:** M

## Task 20: Categorías frontend
**Description:** Pantalla "Categorías" (CRUD) + selects reales en los
formularios de gasto mensual y de tarjeta (reemplazan el input de texto libre).

**Acceptance criteria:**
- [x] Crear/editar/borrar categoría desde la UI; 409 mostrado como error
- [x] Selects poblados desde `/api/categories` en ambos formularios

**Verification:**
- [x] `npm run build` OK
- [x] Manual en navegador: CRUD completo + bloqueo 409 verificados en vivo

**Dependencies:** Task 19
**Files:** `frontend/src/api/categories.ts`, `frontend/src/api/client.ts`, `frontend/src/pages/Categories.tsx`, `frontend/src/pages/MonthlyExpenses.tsx`, `frontend/src/pages/CardExpenses.tsx`, `frontend/src/components/AppShell.tsx`
**Scope:** M

## Task 21: Estado de gastos mensuales backend
**Description:** `status: pagado | anulado` en vez de delete (D15). Anulado se
excluye del summary. Filtros combinables en `GET /api/monthly-expenses` (D18).

**Acceptance criteria:**
- [x] Default `pagado`; `PATCH /{id}/status` anula/reactiva
- [x] `/api/summary` excluye anulados
- [x] Filtros `q`/`category_id`/`date_from`+`date_to`/`month`/`status`,
      combinables con AND; `month` + rango de fechas juntos → 422

**Verification:**
- [x] `pytest` verde

**Dependencies:** Task 19
**Files:** `backend/app/models.py`, `backend/app/routers/monthly_expenses.py`, `backend/app/services/summary.py`, `backend/alembic/versions/0005_*.py`
**Scope:** M

## Task 22: Estado de gastos mensuales frontend
**Description:** Barra de filtros (texto, categoría, fecha/mes, estado) +
acción anular/reactivar por fila.

**Acceptance criteria:**
- [x] Por defecto solo pagados; filtro de estado permite ver anulados/todos
- [x] Anular/reactivar actualiza la fila sin recargar la página

**Verification:**
- [x] `npm run build` OK
- [x] Manual en navegador: anular saca el gasto de la vista, reaparece con el filtro

**Dependencies:** Task 21
**Files:** `frontend/src/api/monthlyExpenses.ts`, `frontend/src/pages/MonthlyExpenses.tsx`
**Scope:** M

## Task 23: Tarjetas backend
**Description:** Reemplaza el par fijo "Tarjeta 1"/"Tarjeta 2" por CRUD real
(D17): nombre, `currency`, `credit_limit`, sin límite de cantidad, estado
activa/desactivada. `card_expenses.amount_clp` se generaliza a `amount` en la
moneda de la tarjeta — destapó que `summary.py` mezclaba toda deuda en CLP.

**Acceptance criteria:**
- [x] Sin límite de tarjetas; `currency` inmutable post-creación
- [x] Desactivar bloquea gastos nuevos (409) pero no el historial
- [x] `available_credit = credit_limit - gastos` (se completa en Task 24)
- [x] Deuda de cada tarjeta en su propia moneda nativa en `/api/summary`

**Verification:**
- [x] `pytest` verde
- [x] Manual: migración probada contra datos legacy reales

**Dependencies:** Task 19
**Files:** `backend/app/models.py`, `backend/app/database.py`, `backend/app/routers/cards.py`, `backend/app/routers/card_expenses.py`, `backend/app/services/cards.py`, `backend/app/services/summary.py`, `backend/alembic/versions/0006_*.py`
**Scope:** M

## Task 24: Pagos de tarjeta backend
**Description:** `CardPayment` repone cupo disponible. Se permite incluso con
la tarjeta desactivada.

**Acceptance criteria:**
- [x] `available_credit = credit_limit - gastos + pagos`
- [x] Pago válido en tarjeta desactivada

**Verification:**
- [x] `pytest` verde

**Dependencies:** Task 23
**Files:** `backend/app/models.py`, `backend/app/routers/card_payments.py`, `backend/app/services/cards.py`, `backend/alembic/versions/0007_*.py`
**Scope:** S

## Task 25: Tarjetas frontend
**Description:** Pantalla "Tarjetas" (crear/editar/activar/desactivar + pagos)
y `CardExpenses.tsx` con selector real y moneda dinámica.

**Acceptance criteria:**
- [x] CRUD de tarjetas + registro de pagos desde la UI
- [x] Tarjeta desactivada no aparece en el selector de gastos nuevos

**Verification:**
- [x] `npm run build` OK
- [x] Manual en navegador: crear tarjeta JPY, pagar, desactivar — verificado en vivo

**Dependencies:** Task 24
**Files:** `frontend/src/api/cards.ts`, `frontend/src/api/cardPayments.ts`, `frontend/src/pages/Cards.tsx`, `frontend/src/pages/CardExpenses.tsx`, `frontend/src/components/AppShell.tsx`
**Scope:** M

## Task 26: Wizard — paso de tarjetas
**Description:** Wizard pasa de 1 a 2 pasos (monedas, luego primera tarjeta).
`App.tsx` resume en el paso correcto según config/tarjetas existentes.

**Acceptance criteria:**
- [x] Config sin tarjetas → resume directo en paso 2 al recargar
- [x] Config + tarjeta → salta el wizard siempre

**Verification:**
- [x] Manual en navegador: flujo completo y caso de resume verificados en vivo

**Dependencies:** Task 25
**Files:** `frontend/src/pages/Wizard.tsx`, `frontend/src/App.tsx`
**Scope:** M

## Task 27: seed_demo.py rework
**Description:** Categorías, tarjetas y pagos de tarjeta demo (hecho en
paralelo a 19/23/24 para no dejar el script roto).

**Acceptance criteria:**
- [x] Idempotente con categorías/tarjetas/pagos incluidos

**Verification:**
- [x] Corrida manual 2 veces seguidas, mismo estado final

**Dependencies:** Tasks 19, 23, 24
**Files:** `backend/scripts/seed_demo.py`
**Scope:** S

## Task 28: Consolidación docs
**Description:** `docs/spec.md` (D15–D18 + sección Migraciones), `README.md`/`README.en.md`.

**Acceptance criteria:**
- [x] Spec y READMEs reflejan el flujo real (wizard de 2 pasos, `deploy.sh
      demo`, tarjetas/categorías/estado/filtros, Alembic)

**Verification:**
- [x] Revisión manual de coherencia end-to-end

**Dependencies:** Tasks 17–27
**Files:** `docs/spec.md`, `README.md`, `README.en.md`, `tasks/todo.md`
**Scope:** S

### Checkpoint: Phase 5 completa → 119 tests backend en verde, build de frontend limpio, flujos verificados en vivo
