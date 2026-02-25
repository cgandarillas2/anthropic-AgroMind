"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MapPin,
  Leaf,
  Cloud,
  BellRing,
  FlaskConical,
  Users,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/farms", label: "Predios", icon: MapPin },
  { href: "/cycles", label: "Ciclo activo", icon: Leaf },
  { href: "/weather", label: "Clima", icon: Cloud },
  { href: "/alerts", label: "Alertas", icon: BellRing },
  { href: "/inputs", label: "Insumos", icon: FlaskConical },
  { href: "/labor", label: "Mano de obra", icon: Users },
  { href: "/ai-agent", label: "Agente IA", icon: Bot },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">AgroMind</span>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-green-50 text-green-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4",
                  isActive ? "text-green-600" : "text-gray-400"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer del sidebar */}
      <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
        Temporada 2024/2025
      </div>
    </aside>
  );
}
