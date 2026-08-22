// Formateo de montos. El backend envía Decimal como string (precisión exacta);
// aquí solo se formatea para mostrar. CLP/JPY sin decimales, USD con 2 (D4).

import { Currency } from "../api/config";

const FRACTION_DIGITS: Record<Currency, number> = {
  CLP: 0,
  JPY: 0,
  USD: 2,
};

// Formatea una cantidad de UF sin ceros de más (el backend la serializa con
// 4 decimales fijos, ej. "8.5000").
export function formatUF(amount: string): string {
  const value = Number(amount);
  return Number.isFinite(value)
    ? value.toLocaleString("es-CL", { maximumFractionDigits: 4 })
    : amount;
}

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
