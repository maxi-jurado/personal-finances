import { useEffect, useState } from "react";

import {
  Category,
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../api/categories";
import { ApiError } from "../api/client";

export default function Categories() {
  const [rows, setRows] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () =>
    listCategories()
      .then(setRows)
      .catch((err: unknown) => setError(errorMessage(err)));

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newName.trim() === "" || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createCategory({ name: newName.trim() });
      setNewName("");
      await reload();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleUpdate = async (id: number) => {
    if (editName.trim() === "" || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateCategory(id, { name: editName.trim() });
      cancelEdit();
      await reload();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setSaving(true);
    setError(null);
    try {
      await deleteCategory(id);
      await reload();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2 className="text-xl font-semibold text-slate-800">Categorías</h2>
      <p className="mt-1 text-sm text-slate-500">
        Usadas en gastos mensuales y gastos de tarjeta. No se puede borrar una
        categoría que ya tiene gastos asociados.
      </p>

      <form
        onSubmit={handleCreate}
        className="mt-4 flex gap-3 rounded-md border border-slate-200 bg-white p-4"
      >
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre de la categoría"
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={newName.trim() === "" || saving}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Agregar
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                  Cargando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                  Sin categorías todavía.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-slate-800">
                    {editingId === row.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded border border-slate-300 px-2 py-1"
                        autoFocus
                      />
                    ) : (
                      row.name
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {editingId === row.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUpdate(row.id)}
                          disabled={saving}
                          className="mr-2 text-sm font-medium text-slate-700 hover:underline"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="text-sm text-slate-400 hover:underline"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="mr-3 text-sm font-medium text-slate-700 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          disabled={saving}
                          className="text-sm font-medium text-red-600 hover:underline"
                        >
                          Borrar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Ocurrió un error inesperado.";
}
