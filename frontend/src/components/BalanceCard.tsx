import { Currency } from "../api/config";
import { formatMoney } from "../lib/money";
import { cn } from "../lib/utils";
import { Card, CardContent, CardHeader } from "./ui/card";

interface Props {
  currency: Currency;
  amount: string;
  subtitle?: string;
}

// Tarjeta de saldo: verde si es positivo, rojo si es negativo (D11).
export default function BalanceCard({ currency, amount, subtitle }: Props) {
  const value = Number(amount);
  const tone = value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

  const toneClass = {
    positive: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950",
    negative: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950",
    neutral: "",
  }[tone];

  const textClass = {
    positive: "text-emerald-700 dark:text-emerald-400",
    negative: "text-red-700 dark:text-red-400",
    neutral: "text-foreground",
  }[tone];

  return (
    <Card className={cn(toneClass)}>
      <CardHeader className="pb-0">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {currency}
        </span>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-semibold tabular-nums", textClass)}>
          {formatMoney(amount, currency)}
        </div>
        {subtitle && (
          <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  );
}
