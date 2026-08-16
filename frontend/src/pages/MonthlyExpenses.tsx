import { useEffect, useState } from "react";

import { Category, listCategories } from "../api/categories";
import { ApiError } from "../api/client";
import { CURRENCIES, Currency } from "../api/config";
import {
  createMonthlyExpense,
  ExpenseStatus,
  listMonthlyExpenses,
  MonthlyExpense as ExpenseRow,
  MonthlyExpenseFilters,
  updateMonthlyExpenseStatus,
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

type DateMode = "none" | "month" | "range";

interface FilterState {
  q: string;
  category_id: string;
  dateMode: DateMode;
  month: string;
  date_from: string;
  date_to: string;
  status: ExpenseStatus | "all";
}

const emptyFilters = (): FilterState => ({
  q: "",
  category_id: "",
  dateMode: "none",
  month: "",
  date_from: "",
  date_to: "",
  status: "pagado",
});

const toApiFilters = (f: FilterState): MonthlyExpenseFilters => ({
  q: f.q.trim() || undefined,
  category_id: f.category_id ? Number(f.category_id) : undefined,
  month: f.dateMode === "month" ? f.month || undefined : undefined,
  date_from: f.dateMode === "range" ? f.date_from || undefined : undefined,
  date_to: f.dateMode === "range" ? f.date_to || undefined : undefined,
  status: f.status,
});

export default function MonthlyExpenses() {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = (f: FilterState = filters) =>
    listMonthlyExpenses(toApiFilters(f))
      .then(setRows)
      .catch((err: unknown) => setError(errorMessage(err)));

  useEffect(() => {
    reload(emptyFilters()).finally(() => setLoading(false));
    listCategories()
      .then(setCategories)
      .catch((err: unknown) => setError(errorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

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
      await createMonthlyExpense({
        date: form.date,
        description: form.description.trim(),
        category_id: Number(form.category_id),
        currency: form.currency,
        amount: form.amount,
      });
      setForm(emptyForm());
      await reload();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleApplyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    reload();
  };

  const handleClearFilters = () => {
    const cleared = emptyFilters();
    setFilters(cleared);
    reload(cleared);
  };

  const handleToggleStatus = async (row: ExpenseRow) => {
    setError(null);
    try {
      await updateMonthlyExpenseStatus(
        row.id,
        row.status === "pagado" ? "anulado" : "pagado",
      );
      await reload();
    } catch (err: unknown) {
      setError(errorMessage(err));
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

      <form
        onSubmit={handleApplyFilters}
        className="mt-4 grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 sm:grid-cols-6"
      >
        <label className="flex flex-col text-sm sm:col-span-2">
          <span className="text-slate-500">Buscar</span>
          <input
            type="text"
            placeholder="Descripción…"
            value={filters.q}
            onChange={(e) => setFilter("q", e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm sm:col-span-1">
          <span className="text-slate-500">Categoría</span>
          <select
            value={filters.category_id}
            onChange={(e) => setFilter("category_id", e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm sm:col-span-1">
          <span className="text-slate-500">Fecha</span>
          <select
            value={filters.dateMode}
            onChange={(e) => setFilter("dateMode", e.target.value as DateMode)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          >
            <option value="none">Todas</option>
            <option value="month">Por mes</option>
            <option value="range">Por rango</option>
          </select>
        </label>
        {filters.dateMode === "month" && (
          <label className="flex flex-col text-sm sm:col-span-1">
            <span className="text-slate-500">Mes</span>
            <input
              type="month"
              value={filters.month}
              onChange={(e) => setFilter("month", e.target.value)}
              className="mt-1 rounded border border-slate-300 px-2 py-1"
            />
          </label>
        )}
        {filters.dateMode === "range" && (
          <>
            <label className="flex flex-col text-sm sm:col-span-1">
              <span className="text-slate-500">Desde</span>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilter("date_from", e.target.value)}
                className="mt-1 rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="flex flex-col text-sm sm:col-span-1">
              <span className="text-slate-500">Hasta</span>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilter("date_to", e.target.value)}
                className="mt-1 rounded border border-slate-300 px-2 py-1"
              />
            </label>
          </>
        )}
        <label className="flex flex-col text-sm sm:col-span-1">
          <span className="text-slate-500">Estado</span>
          <select
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value as ExpenseStatus | "all")}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          >
            <option value="pagado">Pagados</option>
            <option value="anulado">Anulados</option>
            <option value="all">Todos</option>
          </select>
        </label>

        <div className="flex items-end gap-3 sm:col-span-6">
          <button
            type="submit"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-sm text-slate-500 hover:underline"
          >
            Limpiar filtros
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
              <th className="px-4 py-2 text-right font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Cargando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Sin gastos mensuales para estos filtros.
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
                  <td className="px-4 py-2 text-right">
                    <span
                      className={
                        "mr-3 rounded-full px-2 py-0.5 text-xs font-medium " +
                        (row.status === "pagado"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500")
                      }
                    >
                      {row.status === "pagado" ? "Pagado" : "Anulado"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(row)}
                      className="text-sm font-medium text-slate-700 hover:underline"
                    >
                      {row.status === "pagado" ? "Anular" : "Reactivar"}
                    </button>
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
