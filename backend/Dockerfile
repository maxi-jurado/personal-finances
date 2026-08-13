# Backend FastAPI — Finanzas Personales
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Instala dependencias primero (capa cacheable).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código de la app y scripts (seed_demo).
COPY app ./app
COPY scripts ./scripts

# La DB vive fuera del árbol de código, en un volumen (ver docker-compose).
ENV DATABASE_URL=sqlite:////data/finanzas.db
EXPOSE 7412

# host 0.0.0.0 dentro del contenedor; el mapeo a 127.0.0.1 se hace en compose.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${BACKEND_PORT:-7412}"]
