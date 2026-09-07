import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/dashboard" aria-label="ZOO Asistencias, inicio">
      <span className="brand-mark" aria-hidden="true">
        Z
      </span>
      {!compact && (
        <span className="brand-copy">
          <strong>ZOO</strong>
          <small>ASISTENCIAS</small>
        </span>
      )}
    </Link>
  );
}
