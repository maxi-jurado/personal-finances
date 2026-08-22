import { useEffect, useState } from "react";

import { ApiError } from "../api/client";
import { CURRENCIES, Currency } from "../api/config";
import {
  createFixedExpense,
  FixedExpense as ExpenseRow,
  FixedExpenseCreate,
  listFixedExpenses,
} from "../api/fixedExpenses";
import { getLatestUF } from "../api/uf";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { NumericInput } from "../components/NumericInput";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { formatMoney, formatUF } from "../lib/money";

interface FormState {
  concept: string;
  isUF: boolean;
  currency: Currency;
  amount: string;
  ufAmount: string;
  paymentDay: string;
}

const emptyForm = (): FormState => ({
  concept: "",
  isUF: false,
  currency: "CLP",
  amount: "",
  ufAmount: "",
  paymentDay: "1",
});

export default function FixedExpenses() {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ufHint, setUfHint] = useState<string | null>(null);

  useEffect(() => {
    listFixedExpenses()
      .then(setRows)
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));

    // Valor de referencia mientras se escribe el monto en UF; no bloquea el
    // formulario si falla (el backend igual valida al guardar).
    getLatestUF()
      .then((res) => setUfHint(formatMoney(res.value_clp, "CLP")))
      .catch(() => undefined);
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleUF = (checked: boolean) =>
    setForm((prev) => ({ ...prev, isUF: checked, currency: "CLP" }));

  const paymentDay = Number(form.paymentDay);
  const paymentDayValid =
    Number.isInteger(paymentDay) && paymentDay >= 1 && paymentDay <= 31;
  const canSubmit =
    form.concept.trim() !== "" &&
    (form.isUF ? Number(form.ufAmount) > 0 : Number(form.amount) > 0) &&
    paymentDayValid &&
    !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const payload: FixedExpenseCreate = form.isUF
        ? {
            concept: form.concept.trim(),
            currency: "CLP",
            uf_amount: form.ufAmount,
            payment_day: paymentDay,
          }
        : {
            concept: form.concept.trim(),
            currency: form.currency,
            amount: form.amount,
            payment_day: paymentDay,
          };
      const created = await createFixedExpense(payload);
      setRows((prev) => [...prev, created].sort(byPaymentDay));
      setForm(emptyForm());
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Gastos fijos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gastos recurrentes con día de pago (arriendo, créditos, suscripciones).
          Los créditos en UF se pueden registrar en UF: el monto en CLP se
          aproxima con el valor de la UF del día, en vez de quedar congelado.
        </p>
      </div>

      <Card className="p-4">
        <form onSubmit={handleSubmit}>
          <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <Field className="sm:col-span-3">
              <FieldLabel htmlFor="fixed-expense-concept">Concepto</FieldLabel>
              <Input
                id="fixed-expense-concept"
                type="text"
                value={form.concept}
                onChange={(e) => set("concept", e.target.value)}
              />
            </Field>
            <Field orientation="horizontal" className="sm:col-span-2 sm:items-end">
              <Checkbox
                id="fixed-expense-is-uf"
                checked={form.isUF}
                onCheckedChange={(checked) => toggleUF(checked === true)}
              />
              <FieldLabel htmlFor="fixed-expense-is-uf" className="font-normal">
                Es un crédito en UF
              </FieldLabel>
            </Field>
            <Field className="sm:col-span-1">
              <FieldLabel htmlFor="fixed-expense-day">Día de pago</FieldLabel>
              <NumericInput
                id="fixed-expense-day"
                allowDecimal={false}
                maxLength={2}
                value={form.paymentDay}
                onChange={(e) => set("paymentDay", e.target.value)}
              />
            </Field>

            {form.isUF ? (
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="fixed-expense-uf-amount">Monto en UF</FieldLabel>
                <NumericInput
                  id="fixed-expense-uf-amount"
                  value={form.ufAmount}
                  onChange={(e) => set("ufAmount", e.target.value)}
                />
                {ufHint && (
                  <FieldDescription>
                    1 UF ≈ {ufHint} hoy — el valor exacto se recalcula cada vez
                    que se muestra.
                  </FieldDescription>
                )}
              </Field>
            ) : (
              <>
                <Field className="sm:col-span-1">
                  <FieldLabel htmlFor="fixed-expense-currency">Moneda</FieldLabel>
                  <Select
                    value={form.currency}
                    onValueChange={(v) => set("currency", v as Currency)}
                  >
                    <SelectTrigger id="fixed-expense-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="sm:col-span-1">
                  <FieldLabel htmlFor="fixed-expense-amount">Monto</FieldLabel>
                  <NumericInput
                    id="fixed-expense-amount"
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value)}
                  />
                </Field>
              </>
            )}

            <div className="sm:col-span-6">
              <Button type="submit" disabled={!canSubmit}>
                {saving ? "Guardando…" : "Agregar gasto fijo"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Día</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                  Sin gastos fijos todavía.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">{row.payment_day}</TableCell>
                  <TableCell>
                    {row.concept}
                    {row.uf_amount && (
                      <Badge variant="secondary" className="ml-2">
                        {formatUF(row.uf_amount)} UF
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.uf_amount ? "≈ " : ""}
                    {formatMoney(row.amount, row.currency)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}

const byPaymentDay = (a: ExpenseRow, b: ExpenseRow): number =>
  a.payment_day - b.payment_day || a.id - b.id;

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Ocurrió un error inesperado.";
}
