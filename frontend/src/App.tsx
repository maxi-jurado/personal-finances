import { useEffect, useState } from "react";

import { listCards } from "./api/cards";
import { ApiError } from "./api/client";
import { getConfig } from "./api/config";
import AppShell from "./components/AppShell";
import Wizard from "./pages/Wizard";

type ShellState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "wizard-currencies" }
  | { kind: "wizard-cards" }
  | { kind: "ready" };

async function resolveState(): Promise<ShellState> {
  const cfg = await getConfig();
  if (!cfg.configured) return { kind: "wizard-currencies" };

  const cards = await listCards(true);
  if (cards.length === 0) return { kind: "wizard-cards" };

  return { kind: "ready" };
}

export default function App() {
  const [state, setState] = useState<ShellState>({ kind: "loading" });

  useEffect(() => {
    resolveState()
      .then(setState)
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

        {state.kind === "wizard-currencies" && (
          <Wizard
            initialStep="currencies"
            onDone={() => setState({ kind: "ready" })}
          />
        )}

        {state.kind === "wizard-cards" && (
          <Wizard initialStep="cards" onDone={() => setState({ kind: "ready" })} />
        )}

        {state.kind === "ready" && <AppShell />}
      </main>
    </div>
  );
}
