import { useEffect, useState } from "react";

import {
  CardPayment,
  createCardPayment,
  listCardPayments,
} from "../api/cardPayments";
import {
  CreditCard,
  createCard,
  listCards,
  updateCard,
  updateCardStatus,
} from "../api/cards";
import { ApiError } from "../api/client";
import { CURRENCIES, Currency } from "../api/config";
import { formatMoney } from "../lib/money";

const today = () => new Date().toISOString().slice(0, 10);

interface FormState {
  name: string;
  currency: Currency;
  credit_limit: string;
}

const emptyForm = (): FormState => ({ name: "", currency: "CLP", credit_limit: "" });

interface EditState {
  name: string;
  credit_limit: string;
}

interface PaymentFormState {
  date: string;
  amount: string;
  notes: string;
}

const emptyPaymentForm = (): PaymentFormState => ({
  date: today(),
  amount: "",
  notes: "",
});

export default function Cards() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState>({ name: "", credit_limit: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [payments, setPayments] = useState<CardPayment[]>([]);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(emptyPaymentForm);

  const reload = () =>
    listCards(true)
      .then((list) => {
        setCards(list);
        setActiveCard((prev) => prev ?? (list.length > 0 ? list[0].id : null));
      })
      .catch((err: unknown) => setError(errorMessage(err)));

  useEffect(() => {
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeCard === null) return;
    listCardPayments(activeCard)
      .then(setPayments)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [activeCard]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit =
    form.name.trim() !== "" && Number(form.credit_limit) >= 0 && !saving;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await createCard({
        name: form.name.trim(),
        currency: form.currency,
        credit_limit: form.credit_limit,
      });
      setForm(emptyForm());
      await reload();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (card: CreditCard) => {
    setEditingId(card.id);
    setEdit({ name: card.name, credit_limit: card.credit_limit });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit({ name: "", credit_limit: "" });
  };

  const handleUpdate = async (id: number) => {
    if (edit.name.trim() === "" || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateCard(id, { name: edit.name.trim(), credit_limit: edit.credit_limit });
      cancelEdit();
      await reload();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (card: CreditCard) => {
    setError(null);
    try {
      await updateCardStatus(card.id, card.status === "activa" ? "desactivada" : "activa");
      await reload();
    } catch (err: unknown) {
      setError(errorMessage(err));
    }
  };

  const handleCreatePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (activeCard === null || Number(paymentForm.amount) <= 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createCardPayment(activeCard, {
        date: paymentForm.date,
        amount: paymentForm.amount,
        notes: paymentForm.notes.trim() || null,
      });
      setPayments((prev) => [created, ...prev]);
      setPaymentForm(emptyPaymentForm());
      await reload();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const selected = cards.find((c) => c.id === activeCard) ?? null;

  return (
    <section>
      <h2 className="text-xl font-semibold text-slate-800">Tarjetas</h2>
      <p className="mt-1 text-sm text-slate-500">
        Nombre, moneda y cupo de tus tarjetas. El cupo disponible baja con los
        gastos y sube con los pagos que registres.
      </p>

      <form
        onSubmit={handleCreate}
        className="mt-4 grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-6"
      >
        <label className="flex flex-col text-sm sm:col-span-2">
          <span className="text-slate-500">Nombre</span>
          <input
            type="text"
            placeholder="Banco Santander"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
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
        <label className="flex flex-col text-sm sm:col-span-2">
          <span className="text-slate-500">Cupo total</span>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={form.credit_limit}
            onChange={(e) => set("credit_limit", e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <div className="flex items-end sm:col-span-1">
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Agregar
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
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Moneda</th>
              <th className="px-4 py-2 text-right font-medium">Cupo total</th>
              <th className="px-4 py-2 text-right font-medium">Disponible</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Cargando…
                </td>
              </tr>
            ) : cards.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Sin tarjetas todavía.
                </td>
              </tr>
            ) : (
              cards.map((card) => (
                <tr key={card.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-slate-800">
                    {editingId === card.id ? (
                      <input
                        type="text"
                        value={edit.name}
                        onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))}
                        className="rounded border border-slate-300 px-2 py-1"
                        autoFocus
                      />
                    ) : (
                      card.name
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{card.currency}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-800">
                    {editingId === card.id ? (
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        value={edit.credit_limit}
                        onChange={(e) =>
                          setEdit((p) => ({ ...p, credit_limit: e.target.value }))
                        }
                        className="w-28 rounded border border-slate-300 px-2 py-1 text-right"
                      />
                    ) : (
                      formatMoney(card.credit_limit, card.currency)
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-800">
                    {formatMoney(card.available_credit, card.currency)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-medium " +
                        (card.status === "activa"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500")
                      }
                    >
                      {card.status === "activa" ? "Activa" : "Desactivada"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {editingId === card.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUpdate(card.id)}
                          disabled={saving}
                          className="mr-2 text-sm font-medium text-slate-700 hover:underline"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="text-sm text-slate-400 hover:underline"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(card)}
                          className="mr-3 text-sm font-medium text-slate-700 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(card)}
                          className="text-sm font-medium text-slate-500 hover:underline"
                        >
                          {card.status === "activa" ? "Desactivar" : "Activar"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mt-8 text-lg font-semibold text-slate-800">Pagos</h3>
      <p className="mt-1 text-sm text-slate-500">
        Registra un pago para reponer el cupo disponible de la tarjeta.
      </p>

      <label className="mt-4 flex max-w-xs flex-col text-sm">
        <span className="text-slate-500">Tarjeta</span>
        <select
          value={activeCard ?? ""}
          onChange={(e) => setActiveCard(Number(e.target.value))}
          className="mt-1 rounded border border-slate-300 px-2 py-1"
        >
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.currency})
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <>
          <form
            onSubmit={handleCreatePayment}
            className="mt-4 grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-6"
          >
            <label className="flex flex-col text-sm sm:col-span-1">
              <span className="text-slate-500">Fecha</span>
              <input
                type="date"
                value={paymentForm.date}
                onChange={(e) =>
                  setPaymentForm((p) => ({ ...p, date: e.target.value }))
                }
                className="mt-1 rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="flex flex-col text-sm sm:col-span-2">
              <span className="text-slate-500">Monto ({selected.currency})</span>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={paymentForm.amount}
                onChange={(e) =>
                  setPaymentForm((p) => ({ ...p, amount: e.target.value }))
                }
                className="mt-1 rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="flex flex-col text-sm sm:col-span-2">
              <span className="text-slate-500">Notas</span>
              <input
                type="text"
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm((p) => ({ ...p, notes: e.target.value }))
                }
                className="mt-1 rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <div className="flex items-end sm:col-span-1">
              <button
                type="submit"
                disabled={Number(paymentForm.amount) <= 0 || saving}
                className="w-full rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Pagar
              </button>
            </div>
          </form>

          <div className="mt-4 overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium">Notas</th>
                  <th className="px-4 py-2 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                      Sin pagos registrados para esta tarjeta.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2 text-slate-600">{p.date}</td>
                      <td className="px-4 py-2 text-slate-600">{p.notes ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-800">
                        {formatMoney(p.amount, selected.currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Ocurrió un error inesperado.";
}
