import type { AttendanceCoordinates } from "@/features/attendance/types";

export class GeolocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeolocationError";
  }
}

export function getCurrentCoordinates(): Promise<AttendanceCoordinates> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(
      new GeolocationError("Este dispositivo no permite obtener la ubicación.")
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "Debes permitir el acceso a tu ubicación para registrar asistencia."
          : error.code === error.POSITION_UNAVAILABLE
            ? "No se pudo obtener tu ubicación. Activa el GPS e intenta nuevamente."
            : error.code === error.TIMEOUT
              ? "La ubicación tardó demasiado. Verifica tu señal GPS e intenta nuevamente."
              : "No se pudo obtener tu ubicación.";
        reject(new GeolocationError(message));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );
  });
}
