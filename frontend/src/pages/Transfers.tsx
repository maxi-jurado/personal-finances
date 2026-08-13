import { useEffect, useState } from "react";

import { ApiError } from "../api/client";
import { createTransfer, listTransfers, Transfer as TransferRow } from "../api/transfers";
import { formatMoney } from "../lib/money";

const today = () => new Date().toISOString().slice(0, 10);

interface FormState {
  date: string;
  jpyRequested: string;
  clpCharged: string;
}

const emptyForm = (): FormState => ({
  date: today(),
  jpyRequested: "",
  clpCharged: "",
});

// Vista previa de la tasa efectiva (D6). El valor oficial lo calcula el backend;
// esto solo orienta al usuario mientras completa el formulario.
function previewRate(jpy: string, clp: string): string | null {
  const jpyNum = Number(jpy);
  const clpNum = Number(clp);
  if (!(jpyNum > 0) || !(clpNum > 0)) return null;
  return (clpNum / jpyNum).toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function formatRate(rate: string): string {
  const value = Number(rate);
  return Number.isFinite(value)
    ? value.toLocaleString("es-CL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      })
    : rate;
}

export default function Transfers() {
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTransfers()
      .then(setRows)
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit =
    Number(form.jpyRequested) > 0 && Number(form.clpCharged) > 0 && !saving;

  const rate = previewRate(form.jpyRequested, form.clpCharged);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createTransfer({
        date: form.date,
        jpy_requested: form.jpyRequested,
        clp_charged: form.clpCharged,
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
      <h2 className="text-xl font-semibold text-slate-800">Giros CLP → JPY</h2>
      <p className="mt-1 text-sm text-slate-500">
        Ingresa el JPY que pediste y el CLP que te cobró el banco; la tasa
        efectiva se calcula sola (CLP por JPY).
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
          <span className="text-slate-500">JPY solicitado</span>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={form.jpyRequested}
            onChange={(e) => set("jpyRequested", e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm sm:col-span-2">
          <span className="text-slate-500">CLP cobrado</span>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={form.clpCharged}
            onChange={(e) => set("clpCharged", e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <div className="flex flex-col text-sm sm:col-span-1">
          <span className="text-slate-500">Tasa efectiva</span>
          <span className="mt-1 px-2 py-1 tabular-nums text-slate-700">
            {rate ?? "—"}
          </span>
        </div>

        <div className="sm:col-span-6">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? "Guardando…" : "Agregar giro"}
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
              <th className="px-4 py-2 text-right font-medium">JPY solicitado</th>
              <th className="px-4 py-2 text-right font-medium">CLP cobrado</th>
              <th className="px-4 py-2 text-right font-medium">Tasa efectiva</th>
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
                  Sin giros todavía.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-slate-600">{row.date}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-800">
                    {formatMoney(row.jpy_requested, "JPY")}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-800">
                    {formatMoney(row.clp_charged, "CLP")}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-800">
                    {formatRate(row.effective_rate)}
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
