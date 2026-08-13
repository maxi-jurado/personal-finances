# Frontend React/Vite servido por nginx (con proxy /api → backend)

# --- Stage 1: build del bundle de Vite ---
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Stage 2: nginx sirviendo el build estático ---
FROM nginx:1.27-alpine

# Plantilla de nginx: el entrypoint oficial hace envsubst de las vars definidas
# (BACKEND_HOST, BACKEND_PORT, FRONTEND_PORT) sin tocar las de nginx ($uri…).
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 7413
