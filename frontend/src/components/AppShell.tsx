import {
  ArrowLeftRight,
  CalendarClock,
  CreditCard,
  LayoutDashboard,
  Receipt,
  Repeat,
  Tags,
  Wallet,
} from "lucide-react";
import { useState } from "react";

import CardExpenses from "../pages/CardExpenses";
import Cards from "../pages/Cards";
import Categories from "../pages/Categories";
import Dashboard from "../pages/Dashboard";
import FixedExpenses from "../pages/FixedExpenses";
import Income from "../pages/Income";
import MonthlyExpenses from "../pages/MonthlyExpenses";
import Transfers from "../pages/Transfers";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "./ui/sidebar";

type ViewId =
  | "dashboard"
  | "income"
  | "cards"
  | "card-expenses"
  | "monthly-expenses"
  | "fixed-expenses"
  | "transfers"
  | "categories";

interface NavItem {
  id: ViewId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  render: () => JSX.Element;
}

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, render: () => <Dashboard /> },
  { id: "income", label: "Ingresos", icon: Wallet, render: () => <Income /> },
  { id: "cards", label: "Tarjetas", icon: CreditCard, render: () => <Cards /> },
  {
    id: "card-expenses",
    label: "Gastos de tarjeta",
    icon: Receipt,
    render: () => <CardExpenses />,
  },
  {
    id: "monthly-expenses",
    label: "Gastos mensuales",
    icon: CalendarClock,
    render: () => <MonthlyExpenses />,
  },
  {
    id: "fixed-expenses",
    label: "Gastos fijos",
    icon: Repeat,
    render: () => <FixedExpenses />,
  },
  {
    id: "transfers",
    label: "Retiros",
    icon: ArrowLeftRight,
    render: () => <Transfers />,
  },
  {
    id: "categories",
    label: "Categorías",
    icon: Tags,
    render: () => <Categories />,
  },
];

export default function AppShell() {
  const [view, setView] = useState<ViewId>("dashboard");
  const active = NAV.find((item) => item.id === view) ?? NAV[0];

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex flex-col gap-0.5 px-2 py-1.5 group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">Finanzas Personales</span>
            <span className="text-xs text-muted-foreground">CLP · JPY · USD</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={item.id === view}
                      tooltip={item.label}
                      onClick={() => setView(item.id)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <h1 className="text-sm font-medium">{active.label}</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">{active.render()}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
