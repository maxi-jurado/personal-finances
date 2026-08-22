// API de gastos fijos (fixed-expenses).

import { api } from "./client";
import { Currency } from "./config";

export interface FixedExpense {
  id: number;
  concept: string;
  currency: Currency;
  amount: string; // Decimal serializado como string; calculado al vuelo si es en UF
  uf_amount: string | null; // cantidad de UF, si el gasto está denominado en UF
  uf_value: string | null; // valor de la UF usado para calcular `amount`, si aplica
  payment_day: number; // 1–31
  notes: string | null;
}

// Exactamente uno de `amount`/`uf_amount` debe venir; si es `uf_amount`,
// `currency` debe ser CLP (la UF solo convierte a CLP).
export type FixedExpenseCreate = {
  concept: string;
  currency: Currency;
  payment_day: number;
  notes?: string | null;
} & ({ amount: string; uf_amount?: never } | { amount?: never; uf_amount: string });

export const listFixedExpenses = () => api.get<FixedExpense[]>("/fixed-expenses");

export const createFixedExpense = (payload: FixedExpenseCreate) =>
  api.post<FixedExpense>("/fixed-expenses", payload);
