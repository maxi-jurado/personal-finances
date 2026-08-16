import { api } from "./client";

export interface Category {
  id: number;
  name: string;
}

export interface CategoryPayload {
  name: string;
}

export const listCategories = () => api.get<Category[]>("/categories");

export const createCategory = (payload: CategoryPayload) =>
  api.post<Category>("/categories", payload);

export const updateCategory = (id: number, payload: CategoryPayload) =>
  api.patch<Category>(`/categories/${id}`, payload);

export const deleteCategory = (id: number) =>
  api.delete<void>(`/categories/${id}`);
