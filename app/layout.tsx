import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ZOO Asistencias",
    template: "%s | ZOO Asistencias",
  },
  description: "Gestión simple y confiable de asistencia para tu equipo.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
