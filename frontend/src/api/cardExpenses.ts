// API de gastos de tarjeta. El monto va en la moneda de la tarjeta padre
// (ver api/cards.ts) — no tiene moneda propia.

import { api } from "./client";

export interface CardExpense {
  id: number;
  card_id: number;
  date: string; // YYYY-MM-DD
  description: string;
  category_id: number;
  category_name: string;
  amount: string; // Decimal serializado como string
  notes: string | null;
}

export interface CardExpenseCreate {
  date: string;
  description: string;
  category_id: number;
  amount: string;
  notes?: string | null;
}

export const listCardExpenses = (cardId: number) =>
  api.get<CardExpense[]>(`/card-expenses/${cardId}`);

export const createCardExpense = (cardId: number, payload: CardExpenseCreate) =>
  api.post<CardExpense>(`/card-expenses/${cardId}`, payload);
