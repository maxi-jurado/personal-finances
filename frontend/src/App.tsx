import { useEffect, useState } from "react";

import { ApiError } from "./api/client";
import { getConfig } from "./api/config";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import { Skeleton } from "./components/ui/skeleton";
import AppShell from "./components/AppShell";
import Wizard from "./pages/Wizard";

type ShellState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "wizard-currencies" }
  | { kind: "ready" };

// El paso de tarjetas del wizard es solo onboarding: se puede omitir (D17
// extendido) porque "Tarjetas" ya tiene su propio CRUD para agregarlas
// después. Por eso acá solo se gatea por moneda configurada, no por
// cantidad de tarjetas.
async function resolveState(): Promise<ShellState> {
  const cfg = await getConfig();
  if (!cfg.configured) return { kind: "wizard-currencies" };

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

  if (state.kind === "ready") return <AppShell />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold">Finanzas Personales</h1>
          <p className="text-sm text-muted-foreground">CLP · JPY · USD</p>
        </div>

        {state.kind === "loading" && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {state.kind === "error" && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo conectar</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        {state.kind === "wizard-currencies" && (
          <Wizard
            initialStep="currencies"
            onDone={() => setState({ kind: "ready" })}
          />
        )}
      </div>
    </div>
  );
}
