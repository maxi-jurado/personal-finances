import { useEffect, useState } from "react";

import { ApiError } from "../api/client";
import { CURRENCIES, Currency } from "../api/config";
import {
  createFixedExpense,
  FixedExpense as ExpenseRow,
  listFixedExpenses,
} from "../api/fixedExpenses";
import { formatMoney } from "../lib/money";

interface FormState {
  concept: string;
  currency: Currency;
  amount: string;
  paymentDay: string;
}

const emptyForm = (): FormState => ({
  concept: "",
  currency: "CLP",
  amount: "",
  paymentDay: "1",
});

export default function FixedExpenses() {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listFixedExpenses()
      .then(setRows)
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const paymentDay = Number(form.paymentDay);
  const canSubmit =
    form.concept.trim() !== "" &&
    Number(form.amount) > 0 &&
    Number.isInteger(paymentDay) &&
    paymentDay >= 1 &&
    paymentDay <= 31 &&
    !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createFixedExpense({
        concept: form.concept.trim(),
        currency: form.currency,
        amount: form.amount,
        payment_day: paymentDay,
      });
      setRows((prev) => [...prev, created].sort(byPaymentDay));
      setForm(emptyForm());
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2 className="text-xl font-semibold text-slate-800">Gastos fijos</h2>
      <p className="mt-1 text-sm text-slate-500">
        Gastos recurrentes con día de pago (arriendo, créditos, suscripciones).
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-4 grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-6"
      >
        <label className="flex flex-col text-sm sm:col-span-3">
          <span className="text-slate-500">Concepto</span>
          <input
            type="text"
            value={form.concept}
            onChange={(e) => set("concept", e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm sm:col-span-1">
          <span className="text-slate-500">Moneda</span>
          <select
            value={form.currency}
            onChange={(e) => set("currency", e.target.value as Currency)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm sm:col-span-1">
          <span className="text-slate-500">Monto</span>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm sm:col-span-1">
          <span className="text-slate-500">Día de pago</span>
          <input
            type="number"
            min="1"
            max="31"
            step="1"
            inputMode="numeric"
            value={form.paymentDay}
            onChange={(e) => set("paymentDay", e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          />
        </label>

        <div className="sm:col-span-6">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? "Guardando…" : "Agregar gasto fijo"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Día</th>
              <th className="px-4 py-2 font-medium">Concepto</th>
              <th className="px-4 py-2 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                  Cargando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                  Sin gastos fijos todavía.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-slate-600">{row.payment_day}</td>
                  <td className="px-4 py-2 text-slate-800">{row.concept}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-800">
                    {formatMoney(row.amount, row.currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const byPaymentDay = (a: ExpenseRow, b: ExpenseRow): number =>
  a.payment_day - b.payment_day || a.id - b.id;

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Ocurrió un error inesperado.";
}
