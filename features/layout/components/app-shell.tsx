"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import type { SessionUser } from "@/features/auth/types";
import { Avatar } from "@/features/shared/components/avatar";
import { Brand } from "@/features/shared/components/brand";
import { Icon, type IconName } from "@/features/shared/components/icon";

const adminNavigation: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/admin", label: "Resumen", icon: "dashboard" },
  { href: "/asistencia", label: "Tomar asistencia", icon: "clock" },
  { href: "/colaboradores", label: "Colaboradores", icon: "users" },
  { href: "/reportes", label: "Reportes", icon: "document" },
];

const employeeNavigation: typeof adminNavigation = [
  { href: "/asistencia", label: "Tomar asistencia", icon: "clock" },
];

export function AppShell({ children, user }: { children: ReactNode; user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigation = user.role === "admin" ? adminNavigation : employeeNavigation;

  async function logout() {
    setIsLoggingOut(true);
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      {menuOpen && (
        <button
          aria-label="Cerrar menú"
          className="nav-overlay"
          onClick={() => setMenuOpen(false)}
          type="button"
        />
      )}

      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand-row">
          <Brand />
          <button
            aria-label="Cerrar menú"
            className="icon-button sidebar-close"
            onClick={() => setMenuOpen(false)}
            type="button"
          >
            <Icon name="x" />
          </button>
        </div>

        <nav aria-label="Navegación principal" className="sidebar-nav">
          <p className="nav-label">MENÚ PRINCIPAL</p>
          {navigation.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`nav-item ${active ? "nav-item-active" : ""}`}
                href={item.href}
                key={item.href}
                onClick={() => setMenuOpen(false)}
              >
                <Icon name={item.icon} size={19} />
                {item.label}
                {item.href === "/asistencia" && <span className="nav-live-dot" />}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-help">
          <div className="sidebar-help-icon"><Icon name="sparkles" size={18} /></div>
          <strong>¿Necesitas ayuda?</strong>
          <p>Estamos aquí para apoyarte.</p>
          <button type="button">Centro de ayuda</button>
        </div>

        <div className="sidebar-user">
          <Avatar initials={user.initials} label={user.name} size="sm" />
          <span>
            <strong>{user.name}</strong>
            <small>{user.roleLabel}</small>
          </span>
          <button
            aria-label="Cerrar sesión"
            className="icon-button"
            disabled={isLoggingOut}
            onClick={logout}
            title="Cerrar sesión"
            type="button"
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button
            aria-label="Abrir menú"
            className="icon-button mobile-menu-button"
            onClick={() => setMenuOpen(true)}
            type="button"
          >
            <Icon name="menu" />
          </button>
          {user.role === "admin" ? (
            <label className="topbar-search">
              <Icon name="search" size={18} />
              <input aria-label="Buscar" placeholder="Buscar colaborador…" type="search" />
              <kbd>⌘ K</kbd>
            </label>
          ) : <span />}
          <div className="topbar-actions">
            <button aria-label="Notificaciones" className="icon-button notification-button" type="button">
              <Icon name="bell" size={19} />
              <span />
            </button>
            <div className="topbar-divider" />
            <div className="topbar-user">
              <Avatar initials={user.initials} label={user.name} size="sm" />
              <span>
                <strong>{user.name}</strong>
                <small>{user.roleLabel}</small>
              </span>
              <Icon name="chevron-down" size={15} />
            </div>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
