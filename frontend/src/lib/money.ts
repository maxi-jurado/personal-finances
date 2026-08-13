// Formateo de montos. El backend envía Decimal como string (precisión exacta);
// aquí solo se formatea para mostrar. CLP/JPY sin decimales, USD con 2 (D4).

import { Currency } from "../api/config";

const FRACTION_DIGITS: Record<Currency, number> = {
  CLP: 0,
  JPY: 0,
  USD: 2,
};

export function formatMoney(amount: string, currency: Currency): string {
  const value = Number(amount);
  const digits = FRACTION_DIGITS[currency];
  const formatted = Number.isFinite(value)
    ? value.toLocaleString("es-CL", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : amount;
  return `${formatted} ${currency}`;
}
