#!/usr/bin/env bash
#
# deploy.sh — Despliegue local de Finanzas Personales con Docker Compose.
#
# Uso:
#   ./deploy.sh          Construye y levanta el stack en modo productivo
#                        (crea la base si no existe; nunca la puebla con demo)
#   ./deploy.sh demo     Construye y levanta el stack, y puebla datos de demo
#                        si la base está vacía (nunca pisa datos reales)
#   ./deploy.sh down     Detiene y elimina los contenedores
#   ./deploy.sh logs     Sigue los logs de ambos servicios
#   ./deploy.sh status   Muestra el estado de los servicios
#   ./deploy.sh clear-data   Borra el volumen de datos (irreversible, pide confirmación)
#
set -euo pipefail

cd "$(dirname "$0")"

# ── Colores (se desactivan si no hay TTY o si NO_COLOR está definido) ──────────
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  BOLD=$'\e[1m'; DIM=$'\e[2m'; RED=$'\e[31m'; GREEN=$'\e[32m'
  YELLOW=$'\e[33m'; BLUE=$'\e[34m'; CYAN=$'\e[36m'; RESET=$'\e[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; CYAN=""; RESET=""
fi

step()  { printf "\n${BOLD}${BLUE}▶ %s${RESET}\n" "$1"; }
info()  { printf "  ${DIM}%s${RESET}\n" "$1"; }
ok()    { printf "  ${GREEN}✔ %s${RESET}\n" "$1"; }
warn()  { printf "  ${YELLOW}⚠ %s${RESET}\n" "$1"; }
die()   { printf "\n${RED}✗ %s${RESET}\n" "$1" >&2; exit 1; }

# ── Puertos (desde .env / entorno, con los defaults del spec) ─────────────────
[[ -f .env ]] && set -a && source .env && set +a
BACKEND_PORT="${BACKEND_PORT:-7412}"
FRONTEND_PORT="${FRONTEND_PORT:-7413}"

# ── Detecta `docker compose` (v2) vs `docker-compose` (v1) ────────────────────
detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE=(docker-compose)
  else
    die "No encontré Docker Compose. Instala Docker Desktop o el plugin compose."
  fi
}
compose() { "${COMPOSE[@]}" "$@"; }

check_prereqs() {
  step "Verificando prerequisitos"
  command -v docker >/dev/null 2>&1 || die "Docker no está instalado."
  ok "docker disponible"
  docker info >/dev/null 2>&1 || die "El daemon de Docker no está corriendo. Abre Docker Desktop y reintenta."
  ok "daemon de Docker activo"
  detect_compose
  ok "usando: ${COMPOSE[*]}"
  [[ -f .env ]] && ok "config desde .env" || info "sin .env: usando defaults (backend ${BACKEND_PORT}, frontend ${FRONTEND_PORT})"
}

# ── Espera a que el healthcheck del backend pase ──────────────────────────────
wait_healthy() {
  step "Esperando a que el backend esté saludable"
  local cid status
  cid="$(compose ps -q backend || true)"
  [[ -n "$cid" ]] || die "No se creó el contenedor del backend."
  for i in $(seq 1 30); do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo unknown)"
    case "$status" in
      healthy) ok "backend saludable"; return 0 ;;
      unhealthy) die "El backend quedó unhealthy. Revisa: ${COMPOSE[*]} logs backend" ;;
      *) printf "  ${DIM}… %s (%02d/30)${RESET}\r" "$status" "$i" ;;
    esac
    sleep 2
  done
  die "Timeout esperando el healthcheck. Revisa: ${COMPOSE[*]} logs backend"
}

seed_demo() {
  step "Poblando datos de demo"
  compose exec -T backend python scripts/seed_demo.py \
    && ok "datos de demo cargados" \
    || die "Falló el seed. ¿Está el backend levantado? (./deploy.sh up)"
}

# ── Datos: siembra demo SOLO si la base está vacía (nunca pisa datos reales) ──
data_exists() {
  compose exec -T backend python -c \
    "import sys; from app.database import SessionLocal; from app.models import Config; sys.exit(0 if SessionLocal().query(Config).first() else 1)" \
    >/dev/null 2>&1
}

ensure_data() {
  step "Verificando datos"
  if data_exists; then
    ok "ya hay datos configurados (no se tocan)"
  else
    info "base vacía: creando datos de demo…"
    seed_demo
  fi
}

summary() {
  printf "\n${BOLD}${GREEN}✔ Despliegue listo${RESET}\n"
  printf "  ${BOLD}Frontend:${RESET} ${CYAN}http://localhost:%s${RESET}\n" "$FRONTEND_PORT"
  printf "  ${BOLD}API docs:${RESET} ${CYAN}http://localhost:%s/docs${RESET}\n" "$BACKEND_PORT"
}

# ── Consola en vivo: logs en primer plano; Ctrl+C baja el stack, 'd' lo suelta ─
attach_console() {
  printf "\n${BOLD}${CYAN}Consola en vivo${RESET}  ${DIM}[Ctrl+C] detener y bajar · [d] soltar (dejar corriendo)${RESET}\n\n"
  local logs_pid
  compose logs -f --tail=10 &
  logs_pid=$!

  _teardown() {
    trap - INT TERM
    kill "$logs_pid" 2>/dev/null || true
    wait "$logs_pid" 2>/dev/null || true
    printf "\n"
    step "Deteniendo el stack…"
    compose down
    ok "stack detenido"
    exit 0
  }
  trap _teardown INT TERM

  while IFS= read -rsn1 key; do
    if [[ "$key" == "d" || "$key" == "D" ]]; then
      trap - INT TERM
      kill "$logs_pid" 2>/dev/null || true
      printf "\n"
      ok "Consola soltada. El stack sigue corriendo en segundo plano."
      info "Frontend: http://localhost:${FRONTEND_PORT}  ·  Bajar luego: ./deploy.sh down"
      exit 0
    fi
  done
  # EOF de stdin (p.ej. Ctrl+D): deja el stack corriendo.
  kill "$logs_pid" 2>/dev/null || true
}

cmd_up() {
  local mode="$1"; shift || true
  local detach=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -d|--detach) detach=1 ;;
      "") ;;
      *) die "Opción desconocida: $1  (usa: --detach)" ;;
    esac
    shift
  done

  check_prereqs
  step "Construyendo y levantando el stack"
  info "esto puede tardar la primera vez (build de imágenes)…"
  compose up -d --build
  ok "contenedores arriba"
  wait_healthy
  [[ "$mode" == "demo" ]] && ensure_data
  summary

  # Consola interactiva por defecto; con --detach o sin TTY, deja corriendo y sale.
  if [[ $detach -eq 0 && -t 0 ]]; then
    attach_console
  else
    printf "\n"
    info "Contenedores corriendo en segundo plano. Bajar con: ./deploy.sh down"
  fi
}

usage() {
  cat <<'EOF'
deploy.sh — Despliegue local de Finanzas Personales con Docker Compose.

Uso:
  ./deploy.sh                Construye, levanta (modo productivo) y abre la
                             consola en vivo. Crea la base si no existe;
                             nunca la puebla con datos de demo.
  ./deploy.sh demo           Igual, pero si la base está vacía la puebla con
                             datos de demo (nunca pisa datos reales).
  ./deploy.sh --detach       Levanta y sale (no abre la consola en vivo).
                             Combinable: ./deploy.sh demo --detach
  ./deploy.sh down           Detiene y elimina los contenedores.
  ./deploy.sh logs           Sigue los logs de ambos servicios.
  ./deploy.sh status         Muestra el estado de los servicios.
  ./deploy.sh clear-data     Borra el volumen de datos (config, tarjetas,
                             movimientos) para volver a un estado en blanco.
                             Pide confirmación; irreversible. Usa --yes para
                             saltarla en modo no interactivo.

En la consola en vivo:
  [Ctrl+C]  detiene y baja el stack antes de cerrar.
  [d]       suelta la consola y deja el stack corriendo en segundo plano.
EOF
}

cmd_down()   { detect_compose; step "Deteniendo el stack"; compose down; ok "detenido"; }
cmd_logs()   { detect_compose; compose logs -f; }
cmd_status() { detect_compose; compose ps; }

# ── Borra el volumen de datos (config, tarjetas, movimientos). Irreversible. ──
cmd_clear_data() {
  local yes=0
  shift || true
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -y|--yes) yes=1 ;;
      *) die "Opción desconocida: $1  (usa: --yes)" ;;
    esac
    shift
  done

  detect_compose
  step "Borrando datos"
  warn "Esto elimina el volumen de datos completo: configuración, tarjetas,"
  warn "categorías, ingresos, gastos y retiros. NO se puede deshacer."

  if [[ "$yes" -eq 0 ]]; then
    if [[ ! -t 0 ]]; then
      die "Modo no interactivo: pasa --yes para confirmar el borrado (./deploy.sh clear-data --yes)."
    fi
    local confirm=""
    read -r -p "  Escribe 'borrar' para confirmar: " confirm
    [[ "$confirm" == "borrar" ]] || die "Cancelado. No se borró nada."
  fi

  compose down -v
  ok "Datos borrados."
  info "Corre ./deploy.sh (o ./deploy.sh demo) para levantar de nuevo desde cero."
}

case "${1:-}" in
  ""|-d|--detach)         cmd_up "prod" "$@" ;;
  demo)                   shift; cmd_up "demo" "$@" ;;
  down)       cmd_down ;;
  logs)       cmd_logs ;;
  status)     cmd_status ;;
  clear-data) cmd_clear_data "$@" ;;
  -h|--help|help) usage ;;
  *) die "Comando desconocido: $1  (usa: (sin args) | demo | down | logs | status | clear-data)" ;;
esac
