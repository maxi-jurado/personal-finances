// API de tarjetas de crédito (D17): CRUD completo, sin límite de cantidad.

import { api } from "./client";
import { Currency } from "./config";

export type CardStatus = "activa" | "desactivada";

export interface CreditCard {
  id: number;
  name: string;
  currency: Currency;
  credit_limit: string; // Decimal serializado como string
  status: CardStatus;
  available_credit: string; // Decimal serializado como string
}

export interface CreditCardCreate {
  name: string;
  currency: Currency;
  credit_limit: string;
}

export interface CreditCardUpdate {
  name?: string;
  credit_limit?: string;
}

export const listCards = (includeInactive = false) =>
  api.get<CreditCard[]>(
    `/credit-cards${includeInactive ? "?include_inactive=true" : ""}`,
  );

export const createCard = (payload: CreditCardCreate) =>
  api.post<CreditCard>("/credit-cards", payload);

export const updateCard = (id: number, payload: CreditCardUpdate) =>
  api.patch<CreditCard>(`/credit-cards/${id}`, payload);

export const updateCardStatus = (id: number, status: CardStatus) =>
  api.patch<CreditCard>(`/credit-cards/${id}/status`, { status });
