import Link from "next/link";
import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/dashboard" aria-label="ZOO Asistencias, inicio">
      <Image
          src="/logo (2).png"
          width={80}
          height={80}
          alt="ZOO Mazcota"
      />
      {!compact && (
        <span className="brand-copy">
          <strong style={{ fontSize: "16px" }}>
            ASISTENCIA
          </strong>
        </span>
      )}
    </Link>
  );
}
