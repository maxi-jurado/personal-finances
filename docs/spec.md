# Spec: Finanzas Personales (CLP / JPY / USD)

> Documento vivo. Es la fuente de verdad compartida entre el desarrollador y el
> agente. Se actualiza cuando cambian decisiones o alcance, y se versiona junto
> al código.

## Objetivo

Aplicación **local, portable, de un solo usuario** para controlar finanzas
personales moviéndose entre tres monedas: peso chileno (**CLP**), yen japonés
(**JPY**) y dólar (**USD**).

**Contexto de uso:** el usuario vive en Japón, tiene ingresos en CLP, JPY y
también USD, dos tarjetas de crédito chilenas, gastos fijos (arriendo, créditos)
y hace giros periódicos de CLP a JPY. Usa una tarjeta IC japonesa (ICOCA) para
gastos hormiga; sus recargas se registran como un gasto más (ver D12), no como
una cuenta con saldo.

**Usuario:** una sola persona. No hay login, ni multiusuario, ni exposición
pública — corre local o en un contenedor propio.

**Doble propósito:** también es pieza de portafolio open source, por lo que la
calidad de código, estructura, tests y documentación importan tanto como que
funcione.

**Éxito =** el usuario puede registrar ingresos, gastos (tarjeta / mensuales /
fijos) y giros, y ver el balance consolidado del mes expresado en las tres
monedas, con conversiones correctas contra la API real de tipo de cambio.

## Alcance (v1 — estrictamente 3 monedas)

**Dentro:**
- Exactamente CLP, JPY, USD. **No** soporte genérico a monedas arbitrarias.
- Conversiones CLP↔JPY, USD↔JPY, USD↔CLP, todas derivadas de **una** llamada
  diaria a la API base USD.
- Wizard de primer arranque (una pantalla).
- CRUD de ingresos, gastos de tarjeta, gastos mensuales, gastos fijos, giros.
- Summary mensual consolidado en las 3 monedas.
- `seed_demo.py` con datos ficticios realistas.

**Fuera (no hacer en v1):**
- Login / auth / multiusuario.
- Monedas fuera de CLP/JPY/USD o lógica de conversión multi-par genérica.
- Presupuestos, metas, reportes históricos avanzados, export a Excel/PDF.
- Conversión histórica por fecha (ver Decisión D1).
- **Vista histórica / navegación multi-mes en el frontend** (ver D9). El
  endpoint `/api/summary?month=` sigue existiendo, pero la UI de v1 muestra el
  mes actual; la vista histórica se define en un spec aparte.

## Tech Stack

| Capa        | Tecnología                                                       |
|-------------|------------------------------------------------------------------|
| Backend     | Python 3.12 · FastAPI · SQLAlchemy (ORM) · SQLite                |
| Frontend    | React 18 · TypeScript · TailwindCSS · Vite                       |
| Contenedores| Docker · docker-compose (dos servicios separados)               |
| API de tasas| `https://open.er-api.com/v6/latest/USD` (sin API key, gratuita) |

**Puertos** (no convencionales, para no chocar con otros proyectos):
- Backend (uvicorn): **7412** (`BACKEND_PORT`)
- Frontend (nginx sirviendo build de Vite, proxy `/api` → backend): **7413**
  (`FRONTEND_PORT`)

## Decisiones de diseño

- **D1 — Tasa en summary/dashboard:** se usa **la última tasa cacheada** en
  `exchange_rates` para convertir todos los montos del mes. La tabla igual
  guarda un snapshot diario para trazabilidad, pero la consolidación no hace
  conversión histórica por fecha de cada movimiento.
- **D2 — Categorías:** campo `category` es **texto libre** (string). Sin tabla
  ni enum. El seed usa un set realista. **Enmendada por D16** para
  `monthly_expenses`/`card_expenses` (pasan a FK a `categories`); sigue vigente
  tal cual para `income`.
- **D3 — Montos nativos:** cada monto se guarda en su moneda nativa; la
  conversión a las 3 monedas ocurre **solo al mostrar** (summary/dashboard).
- **D4 — Precisión monetaria:** se usa `Numeric`/`Decimal` en SQLAlchemy,
  **nunca `float`**. CLP y JPY se manejan sin decimales; USD con 2.
- **D5 — Cache de tasas:** una fila por día por par (`base`, `target`). La API
  se llama **una vez al día**, nunca por request del usuario.
- **D6 — `effective_rate` de giros:** se calcula en la app como
  `clp_charged / jpy_requested` (el usuario copia el JPY que pidió y el CLP
  total que le cobró el banco; no se desglosa comisión aparte).

## Modelo de datos (SQLite vía SQLAlchemy)

```
config            (id, currencies_json, base_currency, created_at)
exchange_rates    (id, date, base_currency, target_currency, rate, fetched_at)
income            (id, date, description, category, currency, amount, notes)
categories        (id, name)                      -- D16; usada por monthly_expenses/card_expenses
credit_cards      (id, name)                     -- exactamente 2 filas: Tarjeta 1 / Tarjeta 2
card_expenses     (id, card_id FK, date, description, category_id FK, amount_clp, notes)
monthly_expenses  (id, date, description, category_id FK, currency, amount, notes, status)  -- D15
fixed_expenses    (id, concept, currency, amount, payment_day, notes)
transfers         (id, date, jpy_requested, clp_charged, effective_rate, notes)
```

Notas:
- `currency` restringido a `{CLP, JPY, USD}` (validación Pydantic / enum de app).
- `card_expenses.amount_clp`: los gastos de tarjeta chilena vienen en CLP.
- `transfers.effective_rate` se computa, no se ingresa (D6).
- `monthly_expenses.category_id` / `card_expenses.category_id` → FK a `categories` (D16, enmienda D2 solo para estos dos modelos). `income.category` sigue siendo texto libre (D2 vigente).

## API — Endpoints v1

```
GET/POST   /api/config
GET        /api/exchange-rates/latest
GET/POST   /api/income
GET/POST/PATCH/DELETE  /api/categories, /api/categories/{id}         -- D16
GET/POST   /api/card-expenses/{card_id}
GET/POST   /api/monthly-expenses?q=&category_id=&date_from=&date_to=&month=&status=   -- D15, D18
PATCH      /api/monthly-expenses/{id}/status                                          -- D15
GET/POST   /api/fixed-expenses
GET/POST   /api/transfers
GET        /api/summary?month=YYYY-MM      -- balance consolidado del mes en las 3 monedas
```

Flujo de primer arranque (wizard):
1. Al iniciar el backend, si `finanzas.db` no existe → crear schema automáticamente.
2. `GET /api/config` → si no hay config guardada, devuelve `{"configured": false}`.
3. El frontend, al recibir `configured: false`, muestra un wizard de un paso:
   *"¿Cuáles son tus monedas principales?"* con checkboxes limitados a
   **CLP / JPY / USD** (mínimo 2 seleccionadas).
4. `POST /api/config` guarda y redirige al dashboard.
5. Si la DB ya existe y está configurada, se salta el wizard siempre.

## Estructura del proyecto

```
finanzas-app/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── database.py
│   │   ├── routers/
│   │   └── services/exchange_rates.py
│   ├── scripts/seed_demo.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── api/
│   ├── tailwind.config.js
│   ├── package.json
│   └── Dockerfile
├── docs/spec.md
├── tasks/                 (plan.md, todo.md — generados en Phase 2/3)
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## Comandos

**Backend** (desde `backend/`):
```
Instalar:  pip install -r requirements.txt
Dev:       uvicorn app.main:app --reload --port 7412
Test:      pytest
Seed:      python scripts/seed_demo.py
```

**Frontend** (desde `frontend/`):
```
Instalar:  npm install
Dev:       npm run dev
Build:     npm run build
Test:      npm run test        (Vitest, si alcanza el tiempo)
Lint:      npm run lint
```

**Todo junto:**
```
docker-compose up            # levanta ambos servicios sin pasos manuales
```

## Estilo de código

**Backend** — type hints en todo, Pydantic para validación, ORM parametrizado:
```python
class IncomeCreate(BaseModel):
    date: date
    description: str
    category: str
    currency: Currency          # Enum: CLP | JPY | USD
    amount: Decimal             # nunca float
    notes: str | None = None

@router.post("/api/income", response_model=IncomeRead, status_code=201)
def create_income(payload: IncomeCreate, db: Session = Depends(get_db)) -> IncomeRead:
    income = Income(**payload.model_dump())
    db.add(income)
    db.commit()
    db.refresh(income)
    return income
```

**Frontend** — componentes funcionales tipados, cliente API centralizado en
`src/api/`, sin `any`, Tailwind para estilos.

Convenciones: nombres en inglés, `snake_case` en Python, `camelCase` en TS,
funciones y módulos pequeños y con una responsabilidad.

## Estrategia de testing

- **Backend:** `pytest`. Foco en (1) las 3 conversiones de moneda, (2) cálculo
  de `effective_rate`, (3) endpoint `/api/summary`, (4) flujo de config/wizard.
  Tests usan una SQLite en memoria o temporal, nunca la DB real.
- **Frontend:** Vitest + React Testing Library si alcanza el tiempo; prioridad a
  la lógica de conversión/formateo y al render del wizard.
- Correr tests antes de cada commit.

## Requisitos de seguridad (desde el primer commit)

- Queries **siempre parametrizadas** vía ORM — nunca interpolación de strings.
- **CORS restringido** al origin exacto del frontend (`http://localhost:7413`),
  nunca wildcard `*`.
- **Binding de puertos:** dentro del contenedor uvicorn puede bindear a
  `0.0.0.0`, pero el mapeo en `docker-compose.yml` debe ser
  `"127.0.0.1:7412:7412"` y `"127.0.0.1:7413:7413"` — nunca `"7412:7412"`.
- `.gitignore` incluye: `*.db`, `*.sqlite`, `*.sqlite3`, `.env`, `__pycache__/`,
  `node_modules/`.
- `.env.example` documentado; nunca subir un `.env` real.
- Cualquier API key futura se lee de variable de entorno, jamás hardcodeada.

## Boundaries

**Always (siempre):**
- Queries parametrizadas vía ORM.
- Validar entrada con Pydantic; restringir `currency` a {CLP, JPY, USD}.
- Correr tests antes de commitear.
- Cachear la API de tasas (1×/día); nunca llamarla por request.
- Usar `Decimal` para dinero.

**Ask first (preguntar antes):**
- Cambiar el schema de la base de datos.
- Agregar dependencias nuevas.
- Cambiar puertos, config de Docker o de CI.
- Ampliar el alcance de monedas más allá de CLP/JPY/USD.

**Never (nunca):**
- Commitear secretos, `.env` real, o `finanzas.db`.
- Exponer puertos a toda la red (`"7412:7412"` sin `127.0.0.1`).
- CORS con wildcard `*`.
- Usar `float` para montos.
- Interpolar strings en SQL.
- Exponer datos financieros reales en el repo público (usar `seed_demo.py`).

## Criterios de éxito (testables)

1. `docker-compose up` levanta ambos servicios sin pasos manuales adicionales.
2. Con DB inexistente, el primer arranque muestra el wizard; tras guardar
   config, se entra al dashboard y el wizard no vuelve a aparecer.
3. Las 3 conversiones (CLP↔JPY, USD↔JPY, USD↔CLP) dan resultados correctos
   contra la respuesta real de la API (verificable en tests con fixture).
4. `GET /api/summary?month=YYYY-MM` devuelve el balance del mes en CLP, JPY y USD.
5. `effective_rate` de un giro = `clp_charged / jpy_requested`.
6. `seed_demo.py` corre y deja la app usable como demo con datos ficticios.
7. La API externa se consulta a lo más 1×/día (cache verificable).
8. `pytest` pasa; sin secretos ni `*.db` en el repo.
9. README completo: qué hace, capturas, `docker-compose up`, variables de
   entorno, y nota explícita sobre `seed_demo.py`.

## Decisiones resueltas (ex Open Questions)

- **D7 — Dashboard sin gráficos en v1:** el dashboard son **tarjetas de balance
  numérico** en las 3 monedas + tablas de movimientos. **No** se agrega librería
  de charts en v1 (mantiene el scope acotado). Reevaluable en una v2.
- **D8 — Rango del seed:** `seed_demo.py` genera **~4–6 meses** de datos
  ficticios repartidos por mes, para que el endpoint `/api/summary?month=` sea
  demostrable en varios períodos (aunque la UI de v1 muestre el mes actual).
- **D9 — Vista inicial = mes actual:** el dashboard v1 abre y opera sobre el
  **mes en curso**. La navegación histórica multi-mes se define en un spec
  aparte, no en v1.
- **D10 — Ingresos en las 3 monedas:** `income.currency ∈ {CLP, JPY, USD}`. Los
  ingresos pueden registrarse en cualquiera de las tres, incluido USD.
- **D11 — Saldo actual coloreado:** el dashboard muestra el **saldo del mes**
  resaltado en **verde si es positivo, rojo si es negativo**, en las 3 monedas.
  El saldo se deriva del flujo (ingresos − gastos), sin modelo de cuentas ni
  saldo inicial de efectivo. La **deuda de cada tarjeta** (Σ `card_expenses`) se
  muestra por separado, naturalmente en rojo.
- **D12 — IC (ICOCA) como gasto, no como cuenta:** la ICOCA **no** se modela
  como cuenta con saldo. La recarga de la tarjeta se registra como un **gasto
  único** (p.ej. en `monthly_expenses`, categoría "ICOCA", en JPY); los gastos
  hormiga que se pagan con ella los deduce el usuario, no se trackean uno a uno.
  **Sin lógica de descuento/tarifa IC** en v1.
- **D13 — Retiro de dinero (transfers) = movimiento entre monedas, no gasto:**
  un `transfer` es un **retiro** que mueve plata de CLP a JPY, **no** un gasto.
  Tiene dos patas nativas: descuenta `clp_charged` del saldo **CLP** (lo real que
  cobró el banco) y suma `jpy_requested` al saldo **JPY** (efectivo recibido). En
  el summary el saldo es **nativo por moneda** (cada moneda con sus propios
  movimientos); la conversión con la tasa cacheada se usa solo para el
  `total_equivalent` (el patrimonio del mes expresado en las 3 monedas). El
  `effective_rate` sigue siendo `clp_charged / jpy_requested` (D6), informativo.
- **D14 — UF en gastos fijos (diferido a v2):** algunos gastos fijos (p.ej.
  créditos) están denominados en **UF**, que **no** es una de las 3 monedas del
  alcance. En v1 los gastos fijos se registran en CLP/JPY/USD. La conversión
  UF→CLP por el valor de la UF del mes correspondiente (para mantener el gasto
  recurrente en un valor aproximado más exacto) se define en un spec aparte; no
  se implementa en v1. Requiere ampliar el alcance de unidades (ver Boundaries:
  "Ask first").
- **D15 — Estado en vez de delete (`monthly_expenses`):** no existe ningún
  delete en la API. Los gastos mensuales se **anulan** por estado
  (`status: pagado | anulado`, default `pagado`) en vez de borrarse — cubre
  errores de digitación sin perder el registro. Un gasto `anulado` se excluye
  del cálculo de `/api/summary` (no cuenta como gasto real), pero el `GET
  /api/monthly-expenses` lo **oculta por defecto** en vez de no devolverlo
  nunca: con `?status=anulado` o `?status=all` se puede volver a ver (D18).
  Reversible: se puede volver a marcar `pagado`.
- **D16 — Tabla `categories` (enmienda D2 para gastos):** `monthly_expenses` y
  `card_expenses` dejan de usar `category` como texto libre y pasan a
  `category_id` (FK a `categories`, tabla nueva con `id, name` únicos). CRUD
  completo de categorías desde la v1 de esta ampliación (crear/listar/editar/
  borrar), con borrado bloqueado (409) si la categoría está en uso por algún
  gasto. `income.category` **no** se toca — sigue como texto libre bajo D2,
  porque sus categorías (Salario, Freelance) son de otra naturaleza que las de
  gasto (Alimentación, Transporte, etc.). Set inicial sembrado por migración:
  Alimentación, Entretenimiento, Estilo de Vida, Gustos Personales, Aseo y
  Limpieza, Transporte, Salud, Vivienda y Servicios.
- **D18 — Filtros combinables en `GET /api/monthly-expenses`:** `q` (texto,
  busca en `description`), `category_id`, `date_from`/`date_to` **o** `month`
  (mutuamente excluyentes, 422 si se combinan ambos), y `status`. Todos son
  opcionales y se combinan con AND — se puede filtrar por texto + categoría +
  mes al mismo tiempo. Sin filtros, equivale a `status=pagado` (D15).
