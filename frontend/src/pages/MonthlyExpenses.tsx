import { useEffect, useState } from "react";

import { Category, listCategories } from "../api/categories";
import { ApiError } from "../api/client";
import { CURRENCIES, Currency } from "../api/config";
import {
  createMonthlyExpense,
  listMonthlyExpenses,
  MonthlyExpense as ExpenseRow,
} from "../api/monthlyExpenses";
import { formatMoney } from "../lib/money";

const today = () => new Date().toISOString().slice(0, 10);

interface FormState {
  date: string;
  description: string;
  category_id: string;
  currency: Currency;
  amount: string;
}

const emptyForm = (): FormState => ({
  date: today(),
  description: "",
  category_id: "",
  currency: "CLP",
  amount: "",
});

export default function MonthlyExpenses() {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMonthlyExpenses()
      .then(setRows)
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    listCategories()
      .then(setCategories)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit =
    form.description.trim() !== "" &&
    form.category_id !== "" &&
    Number(form.amount) > 0 &&
    !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createMonthlyExpense({
        date: form.date,
        description: form.description.trim(),
        category_id: Number(form.category_id),
        currency: form.currency,
        amount: form.amount,
      });
      setRows((prev) => [created, ...prev]);
      setForm(emptyForm());
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2 className="text-xl font-semibold text-slate-800">Gastos mensuales</h2>
      <p className="mt-1 text-sm text-slate-500">
        Incluye la recarga de la ICOCA como un gasto más.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-4 grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-6"
      >
        <label className="flex flex-col text-sm sm:col-span-1">
          <span className="text-slate-500">Fecha</span>
          <input
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm sm:col-span-2">
          <span className="text-slate-500">Descripción</span>
          <input
            type="text"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm sm:col-span-1">
          <span className="text-slate-500">Categoría</span>
          <select
            value={form.category_id}
            onChange={(e) => set("category_id", e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          >
            <option value="" disabled>
              Elegir…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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

        <div className="sm:col-span-6">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? "Guardando…" : "Agregar gasto"}
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
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Descripción</th>
              <th className="px-4 py-2 font-medium">Categoría</th>
              <th className="px-4 py-2 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Cargando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Sin gastos mensuales todavía.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-slate-600">{row.date}</td>
                  <td className="px-4 py-2 text-slate-800">{row.description}</td>
                  <td className="px-4 py-2 text-slate-600">{row.category_name}</td>
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

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Ocurrió un error inesperado.";
}
