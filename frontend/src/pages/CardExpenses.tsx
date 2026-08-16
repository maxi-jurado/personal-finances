import { useEffect, useState } from "react";

import { Category, listCategories } from "../api/categories";
import { ApiError } from "../api/client";
import {
  CardExpense,
  createCardExpense,
  listCardExpenses,
} from "../api/cardExpenses";
import { CreditCard, listCards } from "../api/cards";
import { formatMoney } from "../lib/money";

const today = () => new Date().toISOString().slice(0, 10);

interface FormState {
  date: string;
  description: string;
  category_id: string;
  amount: string;
}

const emptyForm = (): FormState => ({
  date: today(),
  description: "",
  category_id: "",
  amount: "",
});

export default function CardExpenses() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [rows, setRows] = useState<CardExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carga inicial de tarjetas (solo activas — no se puede gastar en una
  // desactivada).
  useEffect(() => {
    listCards()
      .then((list) => {
        setCards(list);
        if (list.length > 0) setActiveCard(list[0].id);
      })
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    listCategories()
      .then(setCategories)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, []);

  // Carga los gastos de la tarjeta activa.
  useEffect(() => {
    if (activeCard === null) return;
    setError(null);
    listCardExpenses(activeCard)
      .then(setRows)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [activeCard]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const activeCardData = cards.find((c) => c.id === activeCard) ?? null;

  const canSubmit =
    activeCard !== null &&
    form.description.trim() !== "" &&
    form.category_id !== "" &&
    Number(form.amount) > 0 &&
    !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || activeCard === null) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createCardExpense(activeCard, {
        date: form.date,
        description: form.description.trim(),
        category_id: Number(form.category_id),
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
      <h2 className="text-xl font-semibold text-slate-800">Gastos de tarjeta</h2>
      <p className="mt-1 text-sm text-slate-500">
        El monto se registra en la moneda de la tarjeta elegida.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setActiveCard(card.id)}
            className={
              "rounded-md border px-3 py-2 text-sm font-medium " +
              (card.id === activeCard
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-300 bg-white text-slate-600 hover:border-slate-400")
            }
          >
            {card.name} ({card.currency})
          </button>
        ))}
        {!loading && cards.length === 0 && (
          <p className="text-sm text-slate-400">
            No tienes tarjetas activas todavía — creá una en la pestaña "Tarjetas".
          </p>
        )}
      </div>

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
        <label className="flex flex-col text-sm sm:col-span-2">
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
          <span className="text-slate-500">
            Monto{activeCardData ? ` (${activeCardData.currency})` : ""}
          </span>
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
                  Sin gastos en esta tarjeta.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-slate-600">{row.date}</td>
                  <td className="px-4 py-2 text-slate-800">{row.description}</td>
                  <td className="px-4 py-2 text-slate-600">{row.category_name}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-800">
                    {formatMoney(row.amount, activeCardData?.currency ?? "CLP")}
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
