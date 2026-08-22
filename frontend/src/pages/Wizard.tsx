import { useState } from "react";

import { createCard } from "../api/cards";
import { ApiError } from "../api/client";
import { CURRENCIES, Currency, saveConfig } from "../api/config";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../components/ui/field";
import { Input } from "../components/ui/input";
import { NumericInput } from "../components/NumericInput";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

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
    <form onSubmit={handleSubmit}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Paso 1 de 2
      </p>
      <h2 className="mt-1 text-xl font-semibold">
        ¿Cuáles son tus monedas principales?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Selecciona al menos 2. Podrás registrar movimientos en cualquiera de ellas.
      </p>

      <FieldGroup className="mt-4">
        <FieldSet>
          {CURRENCIES.map((currency) => (
            <Field key={currency} orientation="horizontal">
              <Checkbox
                id={`currency-${currency}`}
                checked={selected.has(currency)}
                onCheckedChange={() => toggle(currency)}
              />
              <FieldLabel htmlFor={`currency-${currency}`} className="font-normal">
                {CURRENCY_LABELS[currency]}
              </FieldLabel>
            </Field>
          ))}
        </FieldSet>

        {chosen.length >= 2 && (
          <FieldSet>
            <FieldLegend variant="label">¿Cuál es tu moneda base?</FieldLegend>
            <FieldDescription>
              Es la referencia principal para mostrar tus balances.
            </FieldDescription>
            <RadioGroup
              value={base ?? undefined}
              onValueChange={(value) => setBase(value as Currency)}
            >
              {chosen.map((currency) => (
                <Field key={currency} orientation="horizontal">
                  <RadioGroupItem value={currency} id={`base-${currency}`} />
                  <FieldLabel htmlFor={`base-${currency}`} className="font-normal">
                    {CURRENCY_LABELS[currency]}
                  </FieldLabel>
                </Field>
              ))}
            </RadioGroup>
          </FieldSet>
        )}
      </FieldGroup>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={!canSubmit} className="mt-6">
        {saving ? "Guardando…" : "Continuar"}
      </Button>
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
    <form onSubmit={handleSubmit}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Paso 2 de 2
      </p>
      <h2 className="mt-1 text-xl font-semibold">Registra tu primera tarjeta</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Nombre, moneda y cupo total. Podrás agregar más tarjetas después desde
        &quot;Tarjetas&quot;.
      </p>

      <FieldGroup className="mt-4">
        <Field>
          <FieldLabel htmlFor="wizard-card-name">Nombre</FieldLabel>
          <Input
            id="wizard-card-name"
            type="text"
            placeholder="Banco Santander"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="wizard-card-currency">Moneda</FieldLabel>
          <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
            <SelectTrigger id="wizard-card-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="wizard-card-limit">Cupo total</FieldLabel>
          <NumericInput
            id="wizard-card-limit"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
          />
        </Field>
      </FieldGroup>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button type="submit" disabled={!canSubmit}>
          {saving ? "Guardando…" : "Terminar"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={saving}>
          Omitir por ahora
        </Button>
      </div>
    </form>
  );
}
