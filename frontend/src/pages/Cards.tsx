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
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
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
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Tarjetas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nombre, moneda y cupo de tus tarjetas. El cupo disponible baja con los
          gastos y sube con los pagos que registres.
        </p>
      </div>

      <Card className="p-4">
        <form onSubmit={handleCreate}>
          <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="card-name">Nombre</FieldLabel>
              <Input
                id="card-name"
                type="text"
                placeholder="Banco Santander"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-1">
              <FieldLabel htmlFor="card-currency">Moneda</FieldLabel>
              <Select
                value={form.currency}
                onValueChange={(v) => set("currency", v as Currency)}
              >
                <SelectTrigger id="card-currency">
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
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="card-limit">Cupo total</FieldLabel>
              <NumericInput
                id="card-limit"
                value={form.credit_limit}
                onChange={(e) => set("credit_limit", e.target.value)}
              />
            </Field>
            <div className="flex items-end sm:col-span-1">
              <Button type="submit" disabled={!canSubmit} className="w-full">
                Agregar
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
              <TableHead>Nombre</TableHead>
              <TableHead>Moneda</TableHead>
              <TableHead className="text-right">Cupo total</TableHead>
              <TableHead className="text-right">Disponible</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : cards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  Sin tarjetas todavía.
                </TableCell>
              </TableRow>
            ) : (
              cards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell>
                    {editingId === card.id ? (
                      <Input
                        type="text"
                        value={edit.name}
                        onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))}
                        autoFocus
                      />
                    ) : (
                      card.name
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{card.currency}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {editingId === card.id ? (
                      <NumericInput
                        value={edit.credit_limit}
                        onChange={(e) =>
                          setEdit((p) => ({ ...p, credit_limit: e.target.value }))
                        }
                        className="w-28 text-right"
                      />
                    ) : (
                      formatMoney(card.credit_limit, card.currency)
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(card.available_credit, card.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={card.status === "activa" ? "secondary" : "outline"}>
                      {card.status === "activa" ? "Activa" : "Desactivada"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === card.id ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUpdate(card.id)}
                          disabled={saving}
                        >
                          Guardar
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(card)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(card)}
                        >
                          {card.status === "activa" ? "Desactivar" : "Activar"}
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div>
        <h3 className="text-lg font-semibold">Pagos</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Registra un pago para reponer el cupo disponible de la tarjeta.
        </p>

        <Field className="mt-4 max-w-xs">
          <FieldLabel htmlFor="card-payment-select">Tarjeta</FieldLabel>
          <Select
            value={activeCard !== null ? String(activeCard) : undefined}
            onValueChange={(v) => setActiveCard(Number(v))}
          >
            <SelectTrigger id="card-payment-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {cards.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name} ({c.currency})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        {selected && (
          <div className="mt-4 flex flex-col gap-4">
            <Card className="p-4">
              <form onSubmit={handleCreatePayment}>
                <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-6">
                  <Field className="sm:col-span-1">
                    <FieldLabel htmlFor="card-payment-date">Fecha</FieldLabel>
                    <Input
                      id="card-payment-date"
                      type="date"
                      value={paymentForm.date}
                      onChange={(e) =>
                        setPaymentForm((p) => ({ ...p, date: e.target.value }))
                      }
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="card-payment-amount">
                      Monto ({selected.currency})
                    </FieldLabel>
                    <NumericInput
                      id="card-payment-amount"
                      value={paymentForm.amount}
                      onChange={(e) =>
                        setPaymentForm((p) => ({ ...p, amount: e.target.value }))
                      }
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="card-payment-notes">Notas</FieldLabel>
                    <Input
                      id="card-payment-notes"
                      type="text"
                      value={paymentForm.notes}
                      onChange={(e) =>
                        setPaymentForm((p) => ({ ...p, notes: e.target.value }))
                      }
                    />
                  </Field>
                  <div className="flex items-end sm:col-span-1">
                    <Button
                      type="submit"
                      disabled={Number(paymentForm.amount) <= 0 || saving}
                      className="w-full"
                    >
                      Pagar
                    </Button>
                  </div>
                </FieldGroup>
              </form>
            </Card>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                        Sin pagos registrados para esta tarjeta.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-muted-foreground">{p.date}</TableCell>
                        <TableCell className="text-muted-foreground">{p.notes ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(p.amount, selected.currency)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Ocurrió un error inesperado.";
}
