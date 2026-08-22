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
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { NumericInput } from "../components/NumericInput";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Field, FieldGroup, FieldLabel } from "../components/ui/field";
import { Input } from "../components/ui/input";
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
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Gastos mensuales</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Incluye la recarga de la ICOCA como un gasto más.
        </p>
      </div>

      <Card className="p-4">
        <form onSubmit={handleSubmit}>
          <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <Field className="sm:col-span-1">
              <FieldLabel htmlFor="monthly-expense-date">Fecha</FieldLabel>
              <Input
                id="monthly-expense-date"
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="monthly-expense-description">Descripción</FieldLabel>
              <Input
                id="monthly-expense-description"
                type="text"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-1">
              <FieldLabel htmlFor="monthly-expense-category">Categoría</FieldLabel>
              <Select
                value={form.category_id}
                onValueChange={(v) => set("category_id", v)}
              >
                <SelectTrigger id="monthly-expense-category">
                  <SelectValue placeholder="Elegir…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="sm:col-span-1">
              <FieldLabel htmlFor="monthly-expense-currency">Moneda</FieldLabel>
              <Select
                value={form.currency}
                onValueChange={(v) => set("currency", v as Currency)}
              >
                <SelectTrigger id="monthly-expense-currency">
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
              <FieldLabel htmlFor="monthly-expense-amount">Monto</FieldLabel>
              <NumericInput
                id="monthly-expense-amount"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
              />
            </Field>

            <div className="sm:col-span-6">
              <Button type="submit" disabled={!canSubmit}>
                {saving ? "Guardando…" : "Agregar gasto"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Card>

      <Card className="bg-muted/30 p-4">
        <form onSubmit={handleApplyFilters}>
          <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="monthly-expense-filter-q">Buscar</FieldLabel>
              <Input
                id="monthly-expense-filter-q"
                type="text"
                placeholder="Descripción…"
                value={filters.q}
                onChange={(e) => setFilter("q", e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-1">
              <FieldLabel htmlFor="monthly-expense-filter-category">Categoría</FieldLabel>
              <Select
                value={filters.category_id || "all"}
                onValueChange={(v) => setFilter("category_id", v === "all" ? "" : v)}
              >
                <SelectTrigger id="monthly-expense-filter-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="sm:col-span-1">
              <FieldLabel htmlFor="monthly-expense-filter-datemode">Fecha</FieldLabel>
              <Select
                value={filters.dateMode}
                onValueChange={(v) => setFilter("dateMode", v as DateMode)}
              >
                <SelectTrigger id="monthly-expense-filter-datemode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">Todas</SelectItem>
                    <SelectItem value="month">Por mes</SelectItem>
                    <SelectItem value="range">Por rango</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {filters.dateMode === "month" && (
              <Field className="sm:col-span-1">
                <FieldLabel htmlFor="monthly-expense-filter-month">Mes</FieldLabel>
                <Input
                  id="monthly-expense-filter-month"
                  type="month"
                  value={filters.month}
                  onChange={(e) => setFilter("month", e.target.value)}
                />
              </Field>
            )}
            {filters.dateMode === "range" && (
              <>
                <Field className="sm:col-span-1">
                  <FieldLabel htmlFor="monthly-expense-filter-from">Desde</FieldLabel>
                  <Input
                    id="monthly-expense-filter-from"
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => setFilter("date_from", e.target.value)}
                  />
                </Field>
                <Field className="sm:col-span-1">
                  <FieldLabel htmlFor="monthly-expense-filter-to">Hasta</FieldLabel>
                  <Input
                    id="monthly-expense-filter-to"
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => setFilter("date_to", e.target.value)}
                  />
                </Field>
              </>
            )}
            <Field className="sm:col-span-1">
              <FieldLabel htmlFor="monthly-expense-filter-status">Estado</FieldLabel>
              <Select
                value={filters.status}
                onValueChange={(v) => setFilter("status", v as ExpenseStatus | "all")}
              >
                <SelectTrigger id="monthly-expense-filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="pagado">Pagados</SelectItem>
                    <SelectItem value="anulado">Anulados</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <div className="flex items-end gap-3 sm:col-span-6">
              <Button type="submit" variant="outline">
                Filtrar
              </Button>
              <Button type="button" variant="link" onClick={handleClearFilters}>
                Limpiar filtros
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
              <TableHead className="text-right">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  Sin gastos mensuales para estos filtros.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">{row.date}</TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell className="text-muted-foreground">{row.category_name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(row.amount, row.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={row.status === "pagado" ? "secondary" : "outline"}
                      className="mr-3"
                    >
                      {row.status === "pagado" ? "Pagado" : "Anulado"}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleStatus(row)}
                    >
                      {row.status === "pagado" ? "Anular" : "Reactivar"}
                    </Button>
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
