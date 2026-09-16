"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { getUserHomePath } from "@/features/auth/navigation";
import type { UserRole } from "@/features/auth/types";
import { Icon } from "@/features/shared/components/icon";

export function ChangePasswordForm({ role }: { role: UserRole }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "No se pudo actualizar la contraseña.");
        return;
      }

      router.push(getUserHomePath(role));
      router.refresh();
    } catch {
      setError("No hay conexión con el servidor. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label className="field-label" htmlFor="password">Nueva contraseña</label>
      <div className="field-control">
        <span className="field-leading field-lock" aria-hidden="true">⌑</span>
        <input
          autoComplete="new-password"
          id="password"
          minLength={8}
          name="password"
          placeholder="Mínimo 8 caracteres"
          required
          type={showPassword ? "text" : "password"}
        />
        <button
          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="field-trailing"
          onClick={() => setShowPassword((visible) => !visible)}
          type="button"
        >
          <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
        </button>
      </div>

      <label className="field-label" htmlFor="confirmation">Confirmar contraseña</label>
      <div className="field-control">
        <span className="field-leading field-lock" aria-hidden="true">⌑</span>
        <input
          autoComplete="new-password"
          id="confirmation"
          minLength={8}
          name="confirmation"
          placeholder="Repite tu contraseña"
          required
          type={showPassword ? "text" : "password"}
        />
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button className="button button-primary button-login" disabled={isLoading} type="submit">
        {isLoading ? "Guardando…" : "Guardar y continuar"}
        {!isLoading && <Icon name="arrow-right" size={18} />}
      </button>
    </form>
  );
}
