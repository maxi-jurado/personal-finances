// API de tarjetas y gastos de tarjeta (montos en CLP).

import { api } from "./client";

export interface CreditCard {
  id: number;
  name: string;
}

export interface CardExpense {
  id: number;
  card_id: number;
  date: string; // YYYY-MM-DD
  description: string;
  category: string;
  amount_clp: string; // Decimal serializado como string
  notes: string | null;
}

export interface CardExpenseCreate {
  date: string;
  description: string;
  category: string;
  amount_clp: string;
  notes?: string | null;
}

export const listCards = () => api.get<CreditCard[]>("/credit-cards");

export const listCardExpenses = (cardId: number) =>
  api.get<CardExpense[]>(`/card-expenses/${cardId}`);

export const createCardExpense = (cardId: number, payload: CardExpenseCreate) =>
  api.post<CardExpense>(`/card-expenses/${cardId}`, payload);
