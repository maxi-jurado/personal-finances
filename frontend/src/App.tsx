import { useEffect, useState } from "react";

import { api, ApiError } from "./api/client";

interface ConfigStatus {
  configured: boolean;
}

type ShellState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "unconfigured" }
  | { kind: "ready" };

export default function App() {
  const [state, setState] = useState<ShellState>({ kind: "loading" });

  useEffect(() => {
    api
      .get<ConfigStatus>("/config")
      .then((cfg) => setState({ kind: cfg.configured ? "ready" : "unconfigured" }))
      .catch((err: unknown) => {
        const message =
          err instanceof ApiError
            ? err.message
            : "No se pudo conectar con el backend.";
        setState({ kind: "error", message });
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <h1 className="text-lg font-semibold">Finanzas Personales</h1>
          <p className="text-sm text-slate-500">CLP · JPY · USD</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {state.kind === "loading" && <p className="text-slate-500">Cargando…</p>}

        {state.kind === "error" && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-800">
            {state.message}
          </div>
        )}

        {state.kind === "unconfigured" && (
          <p className="text-slate-600">
            Configuración pendiente — el wizard se agrega en la Task 5.
          </p>
        )}

        {state.kind === "ready" && (
          <p className="text-slate-600">El dashboard se agrega en la Task 12.</p>
        )}
      </main>
    </div>
  );
}
