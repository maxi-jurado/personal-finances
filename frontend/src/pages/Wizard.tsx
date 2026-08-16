import { useState } from "react";

import { createCard } from "../api/cards";
import { ApiError } from "../api/client";
import { CURRENCIES, Currency, saveConfig } from "../api/config";

type Step = "currencies" | "cards";

interface WizardProps {
  initialStep?: Step;
  onDone: () => void;
}

const CURRENCY_LABELS: Record<Currency, string> = {
  CLP: "Peso chileno (CLP)",
  JPY: "Yen japonés (JPY)",
  USD: "Dólar estadounidense (USD)",
};

export default function Wizard({ initialStep = "currencies", onDone }: WizardProps) {
  const [step, setStep] = useState<Step>(initialStep);

  return step === "currencies" ? (
    <CurrenciesStep onNext={() => setStep("cards")} />
  ) : (
    <CardStep onDone={onDone} />
  );
}

function CurrenciesStep({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<Set<Currency>>(new Set());
  const [base, setBase] = useState<Currency | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (currency: Currency) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(currency)) next.delete(currency);
      else next.add(currency);
      return next;
    });
    // Si se deselecciona la moneda base, hay que volver a elegirla.
    setBase((prev) => (prev === currency ? null : prev));
  };

  // Monedas elegidas en orden canónico, para mostrar la base de forma estable.
  const chosen = CURRENCIES.filter((c) => selected.has(c));
  const canSubmit = chosen.length >= 2 && base !== null && !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || base === null) return;

    setSaving(true);
    setError(null);
    try {
      await saveConfig({ currencies: chosen, base_currency: base });
      onNext();
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo guardar la configuración.";
      setError(message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Paso 1 de 2
      </p>
      <h2 className="mt-1 text-xl font-semibold text-slate-800">
        ¿Cuáles son tus monedas principales?
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Selecciona al menos 2. Podrás registrar movimientos en cualquiera de ellas.
      </p>

      <fieldset className="mt-4 space-y-2">
        {CURRENCIES.map((currency) => (
          <label
            key={currency}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 hover:border-slate-300"
          >
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={selected.has(currency)}
              onChange={() => toggle(currency)}
            />
            <span className="text-sm text-slate-700">{CURRENCY_LABELS[currency]}</span>
          </label>
        ))}
      </fieldset>

      {chosen.length >= 2 && (
        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-slate-700">
            ¿Cuál es tu moneda base?
          </legend>
          <p className="mt-1 text-sm text-slate-500">
            Es la referencia principal para mostrar tus balances.
          </p>
          <div className="mt-2 space-y-2">
            {chosen.map((currency) => (
              <label
                key={currency}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 hover:border-slate-300"
              >
                <input
                  type="radio"
                  name="base_currency"
                  className="h-4 w-4"
                  checked={base === currency}
                  onChange={() => setBase(currency)}
                />
                <span className="text-sm text-slate-700">{CURRENCY_LABELS[currency]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-6 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {saving ? "Guardando…" : "Continuar"}
      </button>
    </form>
  );
}

function CardStep({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<Currency>("CLP");
  const [creditLimit, setCreditLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim() !== "" && Number(creditLimit) >= 0 && !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await createCard({ name: name.trim(), currency, credit_limit: creditLimit });
      onDone();
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : "No se pudo crear la tarjeta.";
      setError(message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Paso 2 de 2
      </p>
      <h2 className="mt-1 text-xl font-semibold text-slate-800">
        Registra tu primera tarjeta
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Nombre, moneda y cupo total. Podrás agregar más tarjetas después desde
        "Tarjetas".
      </p>

      <div className="mt-4 space-y-3 rounded-md border border-slate-200 bg-white p-4">
        <label className="flex flex-col text-sm">
          <span className="text-slate-500">Nombre</span>
          <input
            type="text"
            placeholder="Banco Santander"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
            autoFocus
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-slate-500">Moneda</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-slate-500">Cupo total</span>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          />
        </label>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-6 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {saving ? "Guardando…" : "Terminar"}
      </button>
    </form>
  );
}
