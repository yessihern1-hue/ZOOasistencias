import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/components/login-form";
import { Brand } from "@/features/shared/components/brand";
import { Icon } from "@/features/shared/components/icon";
import { getCurrentUser } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Iniciar sesión" };

const benefits = [
  "Registro de entradas y salidas en segundos",
  "Indicadores claros para tomar decisiones",
  "Información de tu equipo en un solo lugar",
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="login-page">
      <section className="login-hero" aria-labelledby="login-hero-title">
        <div className="login-hero-glow login-hero-glow-one" />
        <div className="login-hero-glow login-hero-glow-two" />
        <Brand />

        <div className="login-hero-content">
          <span className="eyebrow eyebrow-light">
            <Icon name="sparkles" size={15} />
            Tu equipo, siempre a tiempo
          </span>
          <h1 id="login-hero-title">
            La asistencia de tu equipo,
            <span> simple y clara.</span>
          </h1>
          <p>
            Controla horarios, visualiza tendencias y mantén a todos sincronizados
            desde un solo lugar.
          </p>
          <ul className="benefit-list">
            {benefits.map((benefit) => (
              <li key={benefit}>
                <span><Icon name="check" size={16} /></span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <p className="login-hero-footer">Gestión humana, resultados reales.</p>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-mobile-brand"><Brand /></div>
        <div className="login-card">
          <div className="login-icon"><Icon name="fingerprint" size={28} /></div>
          <span className="eyebrow">Bienvenido de vuelta</span>
          <h2 id="login-title">Inicia sesión</h2>
          <p className="login-subtitle">Ingresa tus datos para acceder a tu espacio.</p>
          <LoginForm />
          <div className="login-security">
            <Icon name="shield" size={16} />
            Sesión protegida y datos seguros
          </div>
        </div>
        <p className="login-copyright">© 2026 ZOO Asistencias</p>
      </section>
    </main>
  );
}
