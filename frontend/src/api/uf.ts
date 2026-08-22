// API de UF (Unidad de Fomento) — D14 extendido, solo para aproximar gastos
// fijos denominados en UF a su equivalente en CLP.

import { api } from "./client";

export interface UFLatest {
  date: string; // YYYY-MM-DD
  value_clp: string; // Decimal serializado como string
}

export const getLatestUF = () => api.get<UFLatest>("/uf/latest");
