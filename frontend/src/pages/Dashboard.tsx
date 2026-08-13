import { useEffect, useState } from "react";

import { ApiError } from "../api/client";
import { CURRENCIES } from "../api/config";
import { getSummary, Summary, warmRates } from "../api/summary";
import BalanceCard from "../components/BalanceCard";
import { formatMoney } from "../lib/money";

// D9: el dashboard opera sobre el mes en curso.
const currentMonth = () => new Date().toISOString().slice(0, 7);

function monthLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const label = new Date(year, mon - 1).toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function toneClass(amount: string): string {
  const value = Number(amount);
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-red-700";
  return "text-slate-700";
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const month = currentMonth();

  useEffect(() => {
    // Calienta la cache de tasas; si falla, el summary decide (503 con datos).
    warmRates()
      .catch(() => undefined)
      .then(() => getSummary(month))
      .then(setSummary)
      .catch((err: unknown) =>
        setError(
          err instanceof ApiError ? err.message : "No se pudo cargar el resumen.",
        ),
      )
      .finally(() => setLoading(false));
  }, [month]);

  if (loading) return <p className="text-slate-500">Cargando resumen…</p>;

  if (error)
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        {error}
      </div>
    );

  if (!summary) return null;

  const hasDebt = summary.cards.some((c) => Number(c.debt.CLP) !== 0);

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold text-slate-800">
          {monthLabel(summary.month)}
        </h2>
        {summary.rate_date && (
          <span className="text-xs text-slate-400">
            Tasas del {summary.rate_date}
          </span>
        )}
      </div>

      {/* Saldo del mes: nativo por moneda, verde/rojo (D11). */}
      <h3 className="mt-6 text-sm font-medium text-slate-500">Saldo del mes</h3>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CURRENCIES.map((cur) => (
          <BalanceCard key={cur} currency={cur} amount={summary.balance[cur]} />
        ))}
      </div>

      {/* Equivalente total: el patrimonio del mes convertido a cada moneda. */}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="text-slate-500">Equivalente total:</span>
        {CURRENCIES.map((cur) => (
          <span key={cur} className="tabular-nums text-slate-700">
            {formatMoney(summary.total_equivalent[cur], cur)}
          </span>
        ))}
      </div>

      {/* Detalle por moneda del mes. */}
      <h3 className="mt-6 text-sm font-medium text-slate-500">Movimientos del mes</h3>
      <div className="mt-2 overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Moneda</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Ingresos</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Gastos</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Retiros</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {CURRENCIES.map((cur) => (
              <tr key={cur} className="border-b border-slate-100 last:border-0">
                <th scope="row" className="px-4 py-2 font-medium text-slate-700">
                  {cur}
                </th>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                  {formatMoney(summary.income[cur], cur)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                  {formatMoney(summary.expenses[cur], cur)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                  {formatMoney(summary.withdrawals[cur], cur)}
                </td>
                <td className={`px-4 py-2 text-right font-medium tabular-nums ${toneClass(summary.balance[cur])}`}>
                  {formatMoney(summary.balance[cur], cur)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Deuda de tarjetas, aparte y en rojo (D11). */}
      <h3 className="mt-6 text-sm font-medium text-slate-500">Deuda de tarjetas</h3>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {summary.cards.map((card) => (
          <div
            key={card.card_id}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="text-sm font-medium text-slate-700">{card.name}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-red-700">
              {formatMoney(card.debt.CLP, "CLP")}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              ≈ {formatMoney(card.debt.JPY, "JPY")} · {formatMoney(card.debt.USD, "USD")}
            </div>
          </div>
        ))}
      </div>
      {!hasDebt && (
        <p className="mt-2 text-sm text-slate-400">Sin deuda de tarjetas este mes.</p>
      )}
    </section>
  );
}
