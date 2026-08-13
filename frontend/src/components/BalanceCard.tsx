import { Currency } from "../api/config";
import { formatMoney } from "../lib/money";

interface Props {
  currency: Currency;
  amount: string;
  subtitle?: string;
}

// Tarjeta de saldo: verde si es positivo, rojo si es negativo (D11).
export default function BalanceCard({ currency, amount, subtitle }: Props) {
  const value = Number(amount);
  const tone =
    value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

  const styles = {
    positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
    negative: "border-red-200 bg-red-50 text-red-700",
    neutral: "border-slate-200 bg-white text-slate-700",
  }[tone];

  return (
    <div className={`rounded-lg border p-4 ${styles}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {currency}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {formatMoney(amount, currency)}
      </div>
      {subtitle && <div className="mt-1 text-xs text-slate-500">{subtitle}</div>}
    </div>
  );
}
