// API de ingresos (income).

import { api } from "./client";
import { Currency } from "./config";

export interface Income {
  id: number;
  date: string; // YYYY-MM-DD
  description: string;
  category: string;
  currency: Currency;
  amount: string; // Decimal serializado como string
  notes: string | null;
}

export interface IncomeCreate {
  date: string;
  description: string;
  category: string;
  currency: Currency;
  amount: string;
  notes?: string | null;
}

export const listIncome = () => api.get<Income[]>("/income");

export const createIncome = (payload: IncomeCreate) =>
  api.post<Income>("/income", payload);
