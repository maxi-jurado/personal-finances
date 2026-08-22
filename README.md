# Finanzas Personales — CLP · JPY · USD

**Español** · [English](README.en.md)

App **local, de un solo usuario**, para controlar finanzas moviéndose entre tres
monedas: peso chileno (**CLP**), yen japonés (**JPY**) y dólar (**USD**). Pensada
para alguien que vive en Japón con ingresos y gastos repartidos en las tres.

Backend **FastAPI + SQLAlchemy + SQLite**, frontend **React + TypeScript +
Tailwind v4 + shadcn/ui (Vite)**, ambos en **Docker**. Es también una pieza de
portafolio open source, así que la calidad de código, los tests y la
documentación importan tanto como que funcione.

> Corre 100% local. Sin login, sin multiusuario, sin exposición a la red: los
> puertos se ligan solo a `127.0.0.1`.

## Qué hace

- **Wizard de primer arranque** (2 pasos): eliges tus monedas principales
  (mín. 2 de CLP/JPY/USD) y registras tu primera tarjeta. Si cierras a mitad
  de camino, retoma donde quedó.
- **Tarjetas de crédito**: las defines vos (nombre, moneda, cupo total), sin
  límite de cantidad. El **cupo disponible** se calcula solo (`cupo − gastos +
  pagos`); se desactivan en vez de borrarse (una tarjeta desactivada no acepta
  gastos nuevos, pero sí pagos y conserva su historial).
- **Categorías de gasto**: catálogo propio con CRUD completo (crear, editar,
  borrar), compartido entre gastos mensuales y de tarjeta. No se puede borrar
  una categoría que ya tiene gastos asociados.
- **CRUD de movimientos**:
  - **Ingresos** en cualquiera de las 3 monedas.
  - **Gastos de tarjeta**, en la moneda de la tarjeta elegida.
  - **Gastos mensuales** (incluye la recarga de la ICOCA como un gasto más),
    con **estado** `pagado`/`anulado` en vez de borrado — un gasto anulado no
    cuenta en el balance pero el registro nunca se pierde. Filtros combinables
    por texto, categoría, fecha o mes, y estado.
  - **Gastos fijos** recurrentes (arriendo, créditos, suscripciones) con día de pago.
  - **Retiros de dinero** CLP→JPY: registras el JPY recibido y el CLP que te
    cobró el banco; la **tasa efectiva** se calcula sola.
- **Dashboard del mes** con **saldo nativo por moneda** (verde si es positivo,
  rojo si es negativo), el **equivalente total** convertido a las 3 monedas y la
  **deuda de cada tarjeta** por separado, en la moneda de cada una.
- **Conversión de moneda** a partir de **una** llamada diaria a una API pública
  de tasas (base USD), cacheada 1×/día. Todos los montos se guardan en su moneda
  nativa y se convierten solo al mostrar.

Todo el dinero se maneja con `Decimal`/`Numeric` (nunca `float`).

## UI

El frontend usa **shadcn/ui** (componentes sobre Radix UI + Tailwind v4) como
sistema de componentes, con un layout de **sidebar colapsable**
(`AppShell.tsx`). A diferencia de una librería instalada como dependencia
opaca, los componentes de shadcn se copian directo al repo
(`frontend/src/components/ui/`, configurados en `components.json`), así quedan
versionados y son editables como cualquier otro código del proyecto. Es un
cambio puramente de capa de presentación: la lógica de negocio, validaciones y
llamadas a la API de cada página quedaron intactas.

## Capturas

> Se generan a partir de los datos de demo (`seed_demo.py`), 100% ficticios.

| Dashboard del mes | Registro de un retiro |
|---|---|
| ![Dashboard](docs/img/dashboard.png) | ![Retiro de dinero](docs/img/retiro.png) |

_Para regenerarlas: levanta la app con datos de demo (`./deploy.sh demo`) y
guarda las capturas en `docs/img/`._

## Levantar la app

### Opción recomendada: `deploy.sh`

Un solo comando construye, levanta y abre una consola en vivo — en **modo
productivo**: crea la base si no existe, pero nunca la puebla con datos de
demo.

```bash
./deploy.sh
```

Para levantar con datos de demo ficticios (solo si la base está vacía; nunca
pisa datos reales), usa `demo`:

```bash
./deploy.sh demo
```

En la consola en vivo:

- **`Ctrl+C`** detiene y baja el stack antes de cerrar.
- **`d`** suelta la consola y deja el stack corriendo en segundo plano.

Otros comandos:

```bash
./deploy.sh --detach       # levanta y sale (sin consola en vivo); combinable con demo
./deploy.sh down           # detiene y elimina los contenedores
./deploy.sh logs           # sigue los logs
./deploy.sh status         # estado de los servicios
./deploy.sh clear-data     # borra el volumen de datos (config, tarjetas, movimientos);
                            # pide confirmación, irreversible; --yes la salta
```

Una vez arriba:

- **Frontend:** http://localhost:7413
- **API + docs (Swagger):** http://localhost:7412/docs

### Alternativa: Docker Compose a mano

```bash
docker compose up --build -d
docker compose exec backend python scripts/seed_demo.py   # datos de demo (opcional)
```

### Desarrollo local (sin Docker)

Backend (desde `backend/`, con venv en `backend/.venv`):

```bash
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/alembic upgrade head    # opcional en DB nueva; siembra las categorías iniciales
.venv/bin/python -m uvicorn app.main:app --reload --port 7412
```

Frontend (desde `frontend/`):

```bash
npm install
npm run dev        # dev server con proxy /api → backend
```

## Variables de entorno

Copia `.env.example` a `.env` y ajústalo (nunca subas un `.env` real).

| Variable | Default | Descripción |
|---|---|---|
| `BACKEND_PORT` | `7412` | Puerto del backend (uvicorn). |
| `FRONTEND_PORT` | `7413` | Puerto del frontend (nginx sirviendo Vite). |
| `FRONTEND_ORIGIN` | `http://localhost:7413` | Origin exacto permitido por CORS (nunca `*`). |
| `EXCHANGE_RATE_API_URL` | `https://open.er-api.com/v6/latest/USD` | API de tasas (gratuita, sin key). |
| `DATABASE_URL` | `sqlite:///…/finanzas.db` | Solo dev local. En Docker apunta a un volumen persistente. |

Puertos deliberadamente no convencionales para no chocar con otros proyectos.

## Datos de demo (`seed_demo.py`)

`backend/scripts/seed_demo.py` puebla ~5 meses de ingresos, gastos
(tarjeta/mensuales/fijos) y retiros **ficticios pero realistas**, más tasas
cacheadas, para usar la app como demo.

- **No contiene datos financieros reales** — nada personal se versiona en el repo.
- Es **idempotente**: reemplaza las tablas de movimientos, así que correrlo
  varias veces deja siempre el mismo estado.
- `deploy.sh` lo ejecuta solo si la base está vacía; **nunca pisa datos ya
  existentes**.

```bash
# dentro del contenedor
docker compose exec backend python scripts/seed_demo.py
# o en dev local, desde backend/
.venv/bin/python scripts/seed_demo.py
```

## Estructura del proyecto

```
backend/
  app/
    main.py            # entrypoint FastAPI + CORS
    models.py          # modelos ORM (Numeric para dinero, enums Currency/ExpenseStatus/CardStatus)
    routers/           # config, categories, credit-cards, card-expenses, card-payments,
                        # monthly/fixed expenses, income, transfers, summary…
    services/          # exchange_rates.py, cards.py (cupo disponible), summary.py
  alembic/{env.py,versions/}   # migraciones de schema
  scripts/seed_demo.py
  tests/               # pytest (SQLite temporal, nunca la DB real)
  Dockerfile           # corre `alembic upgrade head` antes de uvicorn
frontend/
  src/{api,components,pages,lib}/   # Cards.tsx, Categories.tsx, MonthlyExpenses.tsx (filtros)…
  src/components/ui/    # componentes shadcn/ui (Radix + Tailwind v4), copiados al repo
  components.json       # config del CLI de shadcn (alias, estilo, base color)
  Dockerfile · nginx.conf
docs/spec.md           # spec v1 + decisiones D1–D18
tasks/                 # plan e progreso
deploy.sh · docker-compose.yml
```

## Tests

```bash
cd backend && .venv/bin/python -m pytest
```

Prioriza las 3 conversiones de moneda, el cálculo de la tasa efectiva de retiros,
el endpoint de consolidación (`/api/summary`), el flujo de config/wizard, el
CRUD de categorías y tarjetas (incluidas sus reglas: 409 al borrar una
categoría en uso, 409 al gastar en una tarjeta desactivada, cálculo de cupo
disponible), y que la cadena de migraciones de Alembic coincida con los
modelos. Los tests usan una SQLite temporal y no tocan la red ni `finanzas.db`.

## Seguridad

- Puertos ligados solo a `127.0.0.1` (nunca `"7412:7412"` a toda la red).
- CORS restringido al origin exacto del frontend, sin wildcard.
- Queries siempre parametrizadas vía ORM; validación de entrada con Pydantic.
- `.gitignore` cubre `*.db`, `.env`, etc. Sin secretos en el repo.

## Diseño y decisiones

El detalle vive en [`docs/spec.md`](docs/spec.md), incluidas las decisiones
D1–D18 (p.ej. **D13**: el retiro es un movimiento entre monedas, no un gasto;
**D15**: gastos mensuales se anulan por estado en vez de borrarse; **D17**:
gestión de tarjetas con cupo dinámico y sin límite de cantidad).
