// API de giros (transfers) CLP → JPY.

import { api } from "./client";

export interface Transfer {
  id: number;
  date: string; // YYYY-MM-DD
  jpy_requested: string; // Decimal serializado como string
  clp_charged: string;
  effective_rate: string; // calculado en el backend (D6)
  notes: string | null;
}

export interface TransferCreate {
  date: string;
  jpy_requested: string;
  clp_charged: string;
  notes?: string | null;
}

export const listTransfers = () => api.get<Transfer[]>("/transfers");

export const createTransfer = (payload: TransferCreate) =>
  api.post<Transfer>("/transfers", payload);
