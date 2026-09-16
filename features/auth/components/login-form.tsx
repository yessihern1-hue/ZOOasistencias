"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { LoginResponse } from "@/features/auth/types";
import { getUserEntryPath } from "@/features/auth/navigation";
import { Icon } from "@/features/shared/components/icon";

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const result = (await response.json()) as LoginResponse;

      if (!response.ok) {
        setError(result.error ?? "No pudimos iniciar sesión.");
        return;
      }

      if (!result.user) {
        setError("No se recibió el perfil del usuario.");
        return;
      }

      router.push(getUserEntryPath(result.user));
      router.refresh();
    } catch {
      setError("No hay conexión con el servidor. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="login-form" method="post" onSubmit={handleSubmit}>
      <label className="field-label" htmlFor="email">
        Correo electrónico
      </label>
      <div className="field-control">
        <span className="field-leading" aria-hidden="true">@</span>
        <input
          autoComplete="email"
          autoFocus
          id="email"
          name="email"
          placeholder="nombre@empresa.com"
          required
          type="email"
        />
      </div>

      <label className="field-label" htmlFor="password">
        Contraseña
      </label>
      <div className="field-control">
        <span className="field-leading field-lock" aria-hidden="true">⌑</span>
        <input
          autoComplete="current-password"
          id="password"
          minLength={6}
          name="password"
          placeholder="Tu contraseña"
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

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button className="button button-primary button-login" disabled={isLoading} type="submit">
        {isLoading ? "Ingresando…" : "Iniciar sesión"}
        {!isLoading && <Icon name="arrow-right" size={18} />}
      </button>

      <p className="demo-hint">
        <Icon name="sparkles" size={15} />
        Acceso protegido con Supabase
      </p>
    </form>
  );
}
