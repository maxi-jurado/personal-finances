import { useState } from "react";

import CardExpenses from "../pages/CardExpenses";
import Income from "../pages/Income";
import MonthlyExpenses from "../pages/MonthlyExpenses";

// Navegación simple por estado (sin router). Cada Task de Phase 2 agrega una
// entrada; en Task 12 el dashboard reemplaza el placeholder de abajo.
type ViewId = "dashboard" | "income" | "card-expenses" | "monthly-expenses";

interface NavItem {
  id: ViewId;
  label: string;
  render: () => JSX.Element;
}

const NAV: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    render: () => (
      <p className="text-slate-600">El dashboard se agrega en la Task 12.</p>
    ),
  },
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
