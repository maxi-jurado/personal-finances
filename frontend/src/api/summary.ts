// API de consolidación mensual (dashboard).

import { api } from "./client";
import { Currency } from "./config";

// Monto por moneda; el backend serializa Decimal como string.
export type MoneyByCurrency = Record<Currency, string>;

export interface CardDebt {
  card_id: number;
  name: string;
  debt: MoneyByCurrency;
}

export interface Summary {
  month: string; // YYYY-MM
  rate_date: string | null;
  income: MoneyByCurrency; // nativo por moneda
  expenses: MoneyByCurrency; // nativo por moneda
  withdrawals: MoneyByCurrency; // patas del retiro: CLP ≤ 0, JPY ≥ 0
  balance: MoneyByCurrency; // nativo por moneda
  total_equivalent: MoneyByCurrency; // balance consolidado y convertido
  cards: CardDebt[];
}

export const getSummary = (month: string) =>
  api.get<Summary>(`/summary?month=${encodeURIComponent(month)}`);

// Calienta la cache de tasas (1x/día) antes de pedir el summary, que las
// necesita para el total equivalente y la deuda por tarjeta.
export const warmRates = () => api.get<unknown>("/exchange-rates/latest");
