import { useEffect, useState } from "react";

import { Category, listCategories } from "../api/categories";
import { ApiError } from "../api/client";
import {
  CardExpense,
  createCardExpense,
  listCardExpenses,
} from "../api/cardExpenses";
import { CreditCard, listCards } from "../api/cards";
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
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Gastos de tarjeta</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          El monto se registra en la moneda de la tarjeta elegida.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {cards.map((card) => (
          <Button
            key={card.id}
            type="button"
            variant={card.id === activeCard ? "default" : "outline"}
            onClick={() => setActiveCard(card.id)}
          >
            {card.name} ({card.currency})
          </Button>
        ))}
        {!loading && cards.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No tienes tarjetas activas todavía — creá una en la pestaña &quot;Tarjetas&quot;.
          </p>
        )}
      </div>

      <Card className="p-4">
        <form onSubmit={handleSubmit}>
          <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <Field className="sm:col-span-1">
              <FieldLabel htmlFor="card-expense-date">Fecha</FieldLabel>
              <Input
                id="card-expense-date"
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="card-expense-description">Descripción</FieldLabel>
              <Input
                id="card-expense-description"
                type="text"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="card-expense-category">Categoría</FieldLabel>
              <Select
                value={form.category_id}
                onValueChange={(v) => set("category_id", v)}
              >
                <SelectTrigger id="card-expense-category">
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
              <FieldLabel htmlFor="card-expense-amount">
                Monto{activeCardData ? ` (${activeCardData.currency})` : ""}
              </FieldLabel>
              <NumericInput
                id="card-expense-amount"
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
                  Sin gastos en esta tarjeta.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">{row.date}</TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell className="text-muted-foreground">{row.category_name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(row.amount, activeCardData?.currency ?? "CLP")}
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
