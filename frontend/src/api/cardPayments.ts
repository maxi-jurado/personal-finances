// API de pagos de tarjeta (D17): reponen cupo disponible.

import { api } from "./client";

export interface CardPayment {
  id: number;
  card_id: number;
  date: string; // YYYY-MM-DD
  amount: string; // Decimal serializado como string
  notes: string | null;
}

export interface CardPaymentCreate {
  date: string;
  amount: string;
  notes?: string | null;
}

export const listCardPayments = (cardId: number) =>
  api.get<CardPayment[]>(`/card-payments/${cardId}`);

export const createCardPayment = (cardId: number, payload: CardPaymentCreate) =>
  api.post<CardPayment>(`/card-payments/${cardId}`, payload);
