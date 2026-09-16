import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { getUserHomePath } from "@/features/auth/navigation";
import { Brand } from "@/features/shared/components/brand";
import { Icon } from "@/features/shared/components/icon";
import { getCurrentUser } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Crear contraseña" };

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect(getUserHomePath(user.role));

  return (
    <main className="password-page">
      <div className="password-brand"><Brand /></div>
      <section className="login-card password-card" aria-labelledby="password-title">
        <div className="login-icon"><Icon name="shield" size={28} /></div>
        <span className="eyebrow">PRIMER INGRESO</span>
        <h1 id="password-title">Crea tu contraseña</h1>
        <p className="login-subtitle">
          Hola, {user.name}. La contraseña que recibiste es temporal; define una propia para continuar.
        </p>
        <ChangePasswordForm role={user.role} />
      </section>
    </main>
  );
}
