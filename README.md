# Finanzas Personales — CLP · JPY · USD

**Español** · [English](README.en.md)

App **local, de un solo usuario**, para controlar finanzas moviéndose entre tres
monedas: peso chileno (**CLP**), yen japonés (**JPY**) y dólar (**USD**). Pensada
para alguien que vive en Japón con ingresos y gastos repartidos en las tres.

Backend **FastAPI + SQLAlchemy + SQLite**, frontend **React + TypeScript +
Tailwind (Vite)**, ambos en **Docker**. Es también una pieza de portafolio open
source, así que la calidad de código, los tests y la documentación importan
tanto como que funcione.

> Corre 100% local. Sin login, sin multiusuario, sin exposición a la red: los
> puertos se ligan solo a `127.0.0.1`.

## Qué hace

- **Wizard de primer arranque**: eliges tus monedas principales (mín. 2 de
  CLP/JPY/USD) una sola vez.
- **CRUD de movimientos**:
  - **Ingresos** en cualquiera de las 3 monedas.
  - **Gastos de tarjeta** (2 tarjetas chilenas, en CLP).
  - **Gastos mensuales** (incluye la recarga de la ICOCA como un gasto más).
  - **Gastos fijos** recurrentes (arriendo, créditos, suscripciones) con día de pago.
  - **Retiros de dinero** CLP→JPY: registras el JPY recibido y el CLP que te
    cobró el banco; la **tasa efectiva** se calcula sola.
- **Dashboard del mes** con **saldo nativo por moneda** (verde si es positivo,
  rojo si es negativo), el **equivalente total** convertido a las 3 monedas y la
  **deuda de cada tarjeta** por separado, en rojo.
- **Conversión de moneda** a partir de **una** llamada diaria a una API pública
  de tasas (base USD), cacheada 1×/día. Todos los montos se guardan en su moneda
  nativa y se convierten solo al mostrar.

Todo el dinero se maneja con `Decimal`/`Numeric` (nunca `float`).

## Capturas

> Se generan a partir de los datos de demo (`seed_demo.py`), 100% ficticios.

| Dashboard del mes | Registro de un retiro |
|---|---|
| ![Dashboard](docs/img/dashboard.png) | ![Retiro de dinero](docs/img/retiro.png) |

_Para regenerarlas: levanta la app con datos de demo (`./deploy.sh`) y guarda las
capturas en `docs/img/`._

## Levantar la app

### Opción recomendada: `deploy.sh`

Un solo comando construye, levanta y abre una consola en vivo. Si la base está
vacía, crea datos de demo automáticamente.

```bash
./deploy.sh
```

En la consola en vivo:

- **`Ctrl+C`** detiene y baja el stack antes de cerrar.
- **`d`** suelta la consola y deja el stack corriendo en segundo plano.

Otros comandos:

```bash
./deploy.sh up --no-seed   # levanta sin crear datos de demo (para uso real)
./deploy.sh up --seed      # fuerza recargar los datos de demo (los reemplaza)
./deploy.sh up --detach    # levanta y sale (sin consola en vivo)
./deploy.sh seed           # puebla datos de demo en un backend ya levantado
./deploy.sh down           # detiene y elimina los contenedores
./deploy.sh logs           # sigue los logs
./deploy.sh status         # estado de los servicios
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
    models.py          # modelos ORM (Numeric para dinero, enum Currency)
    routers/           # config, income, card/monthly/fixed expenses, transfers, summary…
    services/          # exchange_rates.py, summary.py
  scripts/seed_demo.py
  tests/               # pytest (SQLite temporal, nunca la DB real)
  Dockerfile
frontend/
  src/{api,components,pages,lib}/
  Dockerfile · nginx.conf
docs/spec.md           # spec v1 + decisiones D1–D14
tasks/                 # plan e progreso
deploy.sh · docker-compose.yml
```

## Tests

```bash
cd backend && .venv/bin/python -m pytest
```

Prioriza las 3 conversiones de moneda, el cálculo de la tasa efectiva de retiros,
el endpoint de consolidación (`/api/summary`) y el flujo de config/wizard. Los
tests usan una SQLite temporal y no tocan la red ni `finanzas.db`.

## Seguridad

- Puertos ligados solo a `127.0.0.1` (nunca `"7412:7412"` a toda la red).
- CORS restringido al origin exacto del frontend, sin wildcard.
- Queries siempre parametrizadas vía ORM; validación de entrada con Pydantic.
- `.gitignore` cubre `*.db`, `.env`, etc. Sin secretos en el repo.

## Diseño y decisiones

El detalle vive en [`docs/spec.md`](docs/spec.md), incluidas las decisiones
D1–D14 (p.ej. **D13**: el retiro es un movimiento entre monedas, no un gasto;
**D14**: gastos fijos en UF, diferidos a una v2).
