import { useState } from "react";

import CardExpenses from "../pages/CardExpenses";
import Categories from "../pages/Categories";
import Dashboard from "../pages/Dashboard";
import FixedExpenses from "../pages/FixedExpenses";
import Income from "../pages/Income";
import MonthlyExpenses from "../pages/MonthlyExpenses";
import Transfers from "../pages/Transfers";

// Navegación simple por estado (sin router). Cada Task de Phase 2 agrega una
// entrada; el dashboard (Task 12) es la vista por defecto.
type ViewId =
  | "dashboard"
  | "income"
  | "card-expenses"
  | "monthly-expenses"
  | "fixed-expenses"
  | "transfers"
  | "categories";

interface NavItem {
  id: ViewId;
  label: string;
  render: () => JSX.Element;
}

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", render: () => <Dashboard /> },
  { id: "income", label: "Ingresos", render: () => <Income /> },
  {
    id: "card-expenses",
    label: "Gastos de tarjeta",
    render: () => <CardExpenses />,
  },
  {
    id: "monthly-expenses",
    label: "Gastos mensuales",
    render: () => <MonthlyExpenses />,
  },
  {
    id: "fixed-expenses",
    label: "Gastos fijos",
    render: () => <FixedExpenses />,
  },
  {
    id: "transfers",
    label: "Retiros",
    render: () => <Transfers />,
  },
  {
    id: "categories",
    label: "Categorías",
    render: () => <Categories />,
  },
];

export default function AppShell() {
  const [view, setView] = useState<ViewId>("dashboard");
  const active = NAV.find((item) => item.id === view) ?? NAV[0];

  return (
    <div>
      <nav className="mb-6 flex gap-1 border-b border-slate-200">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium " +
              (item.id === view
                ? "border-slate-800 text-slate-800"
                : "border-transparent text-slate-500 hover:text-slate-700")
            }
          >
            {item.label}
          </button>
        ))}
      </nav>

      {active.render()}
    </div>
  );
}
