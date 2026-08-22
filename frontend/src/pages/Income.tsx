import { useEffect, useState } from "react";

import { ApiError } from "../api/client";
import { CURRENCIES, Currency } from "../api/config";
import { createIncome, Income as IncomeRow, listIncome } from "../api/income";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Field, FieldGroup, FieldLabel } from "../components/ui/field";
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
import { formatMoney } from "../lib/money";

const today = () => new Date().toISOString().slice(0, 10);

interface FormState {
  date: string;
  description: string;
  category: string;
  currency: Currency;
  amount: string;
}

const emptyForm = (): FormState => ({
  date: today(),
  description: "",
  category: "",
  currency: "CLP",
  amount: "",
});

export default function Income() {
  const [rows, setRows] = useState<IncomeRow[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listIncome()
      .then(setRows)
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit =
    form.description.trim() !== "" &&
    form.category.trim() !== "" &&
    Number(form.amount) > 0 &&
    !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createIncome({
        date: form.date,
        description: form.description.trim(),
        category: form.category.trim(),
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
    <section className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold">Ingresos</h2>

      <Card className="p-4">
        <form onSubmit={handleSubmit}>
          <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <Field className="sm:col-span-1">
              <FieldLabel htmlFor="income-date">Fecha</FieldLabel>
              <Input
                id="income-date"
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="income-description">Descripción</FieldLabel>
              <Input
                id="income-description"
                type="text"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-1">
              <FieldLabel htmlFor="income-category">Categoría</FieldLabel>
              <Input
                id="income-category"
                type="text"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-1">
              <FieldLabel htmlFor="income-currency">Moneda</FieldLabel>
              <Select
                value={form.currency}
                onValueChange={(v) => set("currency", v as Currency)}
              >
                <SelectTrigger id="income-currency">
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
              <FieldLabel htmlFor="income-amount">Monto</FieldLabel>
              <NumericInput
                id="income-amount"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
              />
            </Field>

            <div className="sm:col-span-6">
              <Button type="submit" disabled={!canSubmit}>
                {saving ? "Guardando…" : "Agregar ingreso"}
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
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  Sin ingresos todavía.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">{row.date}</TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell className="text-muted-foreground">{row.category}</TableCell>
                  <TableCell className="text-right tabular-nums">
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

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Ocurrió un error inesperado.";
}
