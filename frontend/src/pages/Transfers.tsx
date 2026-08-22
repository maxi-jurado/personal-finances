import { useEffect, useState } from "react";

import { ApiError } from "../api/client";
import { createTransfer, listTransfers, Transfer as TransferRow } from "../api/transfers";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Field, FieldGroup, FieldLabel } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { NumericInput } from "../components/NumericInput";
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
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Retiro de dinero</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Retiro de CLP a JPY: ingresa el JPY que recibiste y el CLP que te cobró
          el banco. Descuenta el CLP real y suma el efectivo en yenes; la tasa
          efectiva se calcula sola (CLP por JPY).
        </p>
      </div>

      <Card className="p-4">
        <form onSubmit={handleSubmit}>
          <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <Field className="sm:col-span-1">
              <FieldLabel htmlFor="transfer-date">Fecha</FieldLabel>
              <Input
                id="transfer-date"
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="transfer-jpy">JPY solicitado</FieldLabel>
              <NumericInput
                id="transfer-jpy"
                value={form.jpyRequested}
                onChange={(e) => set("jpyRequested", e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="transfer-clp">CLP cobrado</FieldLabel>
              <NumericInput
                id="transfer-clp"
                value={form.clpCharged}
                onChange={(e) => set("clpCharged", e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-1">
              <FieldLabel>Tasa efectiva</FieldLabel>
              <div className="flex h-9 items-center px-1 text-sm tabular-nums">
                {rate ?? "—"}
              </div>
            </Field>

            <div className="sm:col-span-6">
              <Button type="submit" disabled={!canSubmit}>
                {saving ? "Guardando…" : "Agregar giro"}
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
              <TableHead className="text-right">JPY solicitado</TableHead>
              <TableHead className="text-right">CLP cobrado</TableHead>
              <TableHead className="text-right">Tasa efectiva</TableHead>
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
                  Sin giros todavía.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">{row.date}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(row.jpy_requested, "JPY")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(row.clp_charged, "CLP")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRate(row.effective_rate)}
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
