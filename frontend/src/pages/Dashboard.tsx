import { useEffect, useState } from "react";

import { ApiError } from "../api/client";
import { CURRENCIES } from "../api/config";
import { getSummary, Summary, warmRates } from "../api/summary";
import BalanceCard from "../components/BalanceCard";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { formatMoney } from "../lib/money";
import { cn } from "../lib/utils";

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
  if (value > 0) return "text-emerald-700 dark:text-emerald-400";
  if (value < 0) return "text-red-700 dark:text-red-400";
  return "text-foreground";
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

  if (loading)
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );

  if (error)
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );

  if (!summary) return null;

  const hasDebt = summary.cards.some((c) => Number(c.debt.CLP) !== 0);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">{monthLabel(summary.month)}</h2>
        {summary.rate_date && (
          <span className="text-xs text-muted-foreground">
            Tasas del {summary.rate_date}
          </span>
        )}
      </div>

      {/* Saldo del mes: nativo por moneda, verde/rojo (D11). */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground">Saldo del mes</h3>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CURRENCIES.map((cur) => (
            <BalanceCard key={cur} currency={cur} amount={summary.balance[cur]} />
          ))}
        </div>

        {/* Equivalente total: el patrimonio del mes convertido a cada moneda. */}
        <Card className="mt-3">
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-1 py-3 text-sm">
            <span className="text-muted-foreground">Equivalente total:</span>
            {CURRENCIES.map((cur) => (
              <span key={cur} className="tabular-nums">
                {formatMoney(summary.total_equivalent[cur], cur)}
              </span>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Detalle por moneda del mes. */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground">
          Movimientos del mes
        </h3>
        <Card className="mt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Moneda</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Gastos</TableHead>
                <TableHead className="text-right">Retiros</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CURRENCIES.map((cur) => (
                <TableRow key={cur}>
                  <TableCell className="font-medium">{cur}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(summary.income[cur], cur)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(summary.expenses[cur], cur)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(summary.withdrawals[cur], cur)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium tabular-nums",
                      toneClass(summary.balance[cur]),
                    )}
                  >
                    {formatMoney(summary.balance[cur], cur)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Deuda de tarjetas, aparte y en rojo (D11). */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground">
          Deuda de tarjetas
        </h3>
        {hasDebt ? (
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {summary.cards.map((card) => (
              <Card key={card.card_id}>
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm font-medium">{card.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tabular-nums text-red-700 dark:text-red-400">
                    {formatMoney(card.debt.CLP, "CLP")}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    ≈ {formatMoney(card.debt.JPY, "JPY")} ·{" "}
                    {formatMoney(card.debt.USD, "USD")}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Sin deuda de tarjetas este mes.
          </p>
        )}
      </div>
    </section>
  );
}
