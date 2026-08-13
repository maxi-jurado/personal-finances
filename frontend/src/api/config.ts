// API de configuración (wizard de primer arranque).

import { api } from "./client";

export type Currency = "CLP" | "JPY" | "USD";

export const CURRENCIES: Currency[] = ["CLP", "JPY", "USD"];

export interface ConfigStatus {
  configured: boolean;
  currencies: Currency[] | null;
  base_currency: Currency | null;
}

export interface ConfigCreate {
  currencies: Currency[];
  base_currency?: Currency;
}

export const getConfig = () => api.get<ConfigStatus>("/config");

export const saveConfig = (payload: ConfigCreate) =>
  api.post<ConfigStatus>("/config", payload);
