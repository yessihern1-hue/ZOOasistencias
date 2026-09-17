"use client";

import { type FormEvent, useMemo, useState } from "react";

import { GeolocationError, getCurrentCoordinates } from "@/features/attendance/geolocation";
import type { AttendanceLocation, AttendanceLocationInput } from "@/features/locations/types";
import { Icon } from "@/features/shared/components/icon";

type LocationsResponse = { locations?: AttendanceLocation[]; error?: string };

export function AttendanceLocationsView({
  initialLocations,
}: {
  initialLocations: AttendanceLocation[];
}) {
  const [locations, setLocations] = useState(initialLocations);
  const [editing, setEditing] = useState<AttendanceLocation | "new" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const activeCount = useMemo(
    () => locations.filter((location) => location.active).length,
    [locations]
  );

  async function saveLocation(input: AttendanceLocationInput) {
    if (!editing) return;
    setIsSaving(true);
    setError("");
    const isNew = editing === "new";

    try {
      const response = await fetch(
        isNew ? "/api/v1/attendance-locations" : `/api/v1/attendance-locations/${editing.id}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const result = (await response.json()) as LocationsResponse;
      if (!response.ok) {
        setError(result.error ?? "No se pudo guardar la ubicación.");
        return;
      }
      if (result.locations) setLocations(result.locations);
      setEditing(null);
    } catch {
      setError("No hay conexión con el servidor.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleLocation(location: AttendanceLocation) {
    if (location.active && !window.confirm(
      "Los empleados dejarán de poder registrar desde esta ubicación. ¿Deseas continuar?"
    )) return;

    setUpdatingId(location.id);
    try {
      const response = await fetch(`/api/v1/attendance-locations/${location.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !location.active }),
      });
      const result = (await response.json()) as LocationsResponse;
      if (!response.ok) {
        window.alert(result.error ?? "No se pudo cambiar el estado de la ubicación.");
        return;
      }
      if (result.locations) setLocations(result.locations);
    } catch {
      window.alert("No hay conexión con el servidor.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-heading heading-with-action">
        <div>
          <span className="eyebrow">CONTROL POR GEOLOCALIZACIÓN</span>
          <h1>Ubicaciones autorizadas</h1>
          <p>Define las sedes y el radio desde el que se permite marcar asistencia.</p>
        </div>
        <button className="button button-primary" onClick={() => { setError(""); setEditing("new"); }} type="button">
          <span className="button-plus">+</span>Nueva ubicación
        </button>
      </header>

      <section className="directory-stats">
        <article className="panel directory-stat"><span className="stat-icon stat-blue"><Icon name="map-pin" /></span><div><strong>{locations.length}</strong><small>Total ubicaciones</small></div></article>
        <article className="panel directory-stat"><span className="stat-icon stat-green"><Icon name="check" /></span><div><strong>{activeCount}</strong><small>Ubicaciones activas</small></div></article>
        <article className="panel directory-stat"><span className="stat-icon stat-amber"><Icon name="shield" /></span><div><strong>{locations.length ? Math.round(locations.reduce((sum, item) => sum + item.allowedRadiusMeters, 0) / locations.length) : 0} m</strong><small>Radio promedio</small></div></article>
      </section>

      {!activeCount && (
        <p className="location-warning" role="alert">
          <Icon name="map-pin" size={17} /> Crea una ubicación activa antes de probar la asistencia.
        </p>
      )}

      <section className="location-grid">
        {locations.map((location) => (
          <article className={`panel location-card ${location.active ? "" : "location-card-inactive"}`} key={location.id}>
            <header className="shift-card-header">
              <span className="shift-card-icon"><Icon name="map-pin" size={20} /></span>
              <div><h2>{location.name}</h2><p>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p></div>
              <span className={`status-badge status-${location.active ? "present" : "absent"}`}>{location.active ? "Activa" : "Inactiva"}</span>
            </header>
            <div className="location-radius"><small>RADIO PERMITIDO</small><strong>{location.allowedRadiusMeters} m</strong></div>
            <p className="location-card-copy">La distancia se calcula en Supabase al registrar cada entrada y salida.</p>
            <footer className="shift-card-footer">
              <span><Icon name="shield" size={14} />Validación del lado servidor</span>
              <div>
                <button className="table-action" onClick={() => { setError(""); setEditing(location); }} type="button">Editar</button>
                <button className={`table-action ${location.active ? "danger-action" : ""}`} disabled={updatingId === location.id} onClick={() => toggleLocation(location)} type="button">
                  {updatingId === location.id ? "Guardando…" : location.active ? "Desactivar" : "Activar"}
                </button>
              </div>
            </footer>
          </article>
        ))}
        {!locations.length && (
          <div className="panel shift-empty"><Icon name="map-pin" size={34} /><h2>Aún no hay ubicaciones</h2><p>Crea la sede principal para habilitar el registro de asistencia.</p></div>
        )}
      </section>

      {editing && (
        <div className="modal-backdrop" role="presentation">
          <section aria-labelledby="location-modal-title" aria-modal="true" className="employee-modal" role="dialog">
            <header className="modal-header">
              <div><span className="eyebrow">GEOREFERENCIA</span><h2 id="location-modal-title">{editing === "new" ? "Nueva ubicación" : `Editar ${editing.name}`}</h2></div>
              <button aria-label="Cerrar" className="icon-button" disabled={isSaving} onClick={() => setEditing(null)} type="button"><Icon name="x" /></button>
            </header>
            <LocationForm error={error} isSaving={isSaving} location={editing === "new" ? undefined : editing} onCancel={() => setEditing(null)} onSave={saveLocation} />
          </section>
        </div>
      )}
    </div>
  );
}

function LocationForm({
  error,
  isSaving,
  location,
  onCancel,
  onSave,
}: {
  error: string;
  isSaving: boolean;
  location?: AttendanceLocation;
  onCancel: () => void;
  onSave: (input: AttendanceLocationInput) => void;
}) {
  const [latitude, setLatitude] = useState(location?.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(location?.longitude?.toString() ?? "");
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  async function useCurrentLocation() {
    setIsLocating(true);
    setLocationError("");
    try {
      const coordinates = await getCurrentCoordinates();
      setLatitude(coordinates.latitude.toFixed(7));
      setLongitude(coordinates.longitude.toFixed(7));
    } catch (currentError) {
      setLocationError(currentError instanceof GeolocationError ? currentError.message : "No se pudo obtener la ubicación.");
    } finally {
      setIsLocating(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({
      name: String(form.get("name") ?? ""),
      latitude: Number(latitude),
      longitude: Number(longitude),
      allowedRadiusMeters: Number(form.get("allowedRadiusMeters")),
    });
  }

  return (
    <form className="employee-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="admin-field admin-field-wide"><span>Nombre de la sede</span><input defaultValue={location?.name ?? ""} maxLength={120} name="name" placeholder="Ej. Oficina central" required /></label>
        <label className="admin-field"><span>Latitud</span><input max={90} min={-90} onChange={(event) => setLatitude(event.target.value)} required step="any" type="number" value={latitude} /></label>
        <label className="admin-field"><span>Longitud</span><input max={180} min={-180} onChange={(event) => setLongitude(event.target.value)} required step="any" type="number" value={longitude} /></label>
        <label className="admin-field admin-field-wide"><span>Radio permitido</span><div className="number-with-unit"><input defaultValue={location?.allowedRadiusMeters ?? 100} max={10000} min={10} name="allowedRadiusMeters" required type="number" /><small>m</small></div></label>
      </div>
      <button className="button button-secondary location-current-button" disabled={isLocating || isSaving} onClick={useCurrentLocation} type="button"><Icon name="map-pin" size={16} />{isLocating ? "Obteniendo ubicación…" : "Usar mi ubicación actual"}</button>
      <p className="location-form-help">Ubícate en el punto central de la sede y usa tu posición actual. Puedes ajustar las coordenadas manualmente.</p>
      {locationError && <p className="form-error" role="alert">{locationError}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="modal-actions"><button className="button button-secondary" disabled={isSaving} onClick={onCancel} type="button">Cancelar</button><button className="button button-primary" disabled={isSaving || isLocating} type="submit">{isSaving ? "Guardando…" : "Guardar ubicación"}</button></footer>
    </form>
  );
}
