// API de gastos mensuales (monthly-expenses).

import { api } from "./client";
import { Currency } from "./config";

export interface MonthlyExpense {
  id: number;
  date: string; // YYYY-MM-DD
  description: string;
  category_id: number;
  category_name: string;
  currency: Currency;
  amount: string; // Decimal serializado como string
  notes: string | null;
}

export interface MonthlyExpenseCreate {
  date: string;
  description: string;
  category_id: number;
  currency: Currency;
  amount: string;
  notes?: string | null;
}

export const listMonthlyExpenses = () =>
  api.get<MonthlyExpense[]>("/monthly-expenses");

export const createMonthlyExpense = (payload: MonthlyExpenseCreate) =>
  api.post<MonthlyExpense>("/monthly-expenses", payload);
