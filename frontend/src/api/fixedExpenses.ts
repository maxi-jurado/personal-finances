// API de gastos fijos (fixed-expenses).

import { api } from "./client";
import { Currency } from "./config";

export interface FixedExpense {
  id: number;
  concept: string;
  currency: Currency;
  amount: string; // Decimal serializado como string
  payment_day: number; // 1–31
  notes: string | null;
}

export interface FixedExpenseCreate {
  concept: string;
  currency: Currency;
  amount: string;
  payment_day: number;
  notes?: string | null;
}

export const listFixedExpenses = () => api.get<FixedExpense[]>("/fixed-expenses");

export const createFixedExpense = (payload: FixedExpenseCreate) =>
  api.post<FixedExpense>("/fixed-expenses", payload);
