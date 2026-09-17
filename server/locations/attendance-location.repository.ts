import "server-only";

import type { AttendanceLocation, AttendanceLocationInput } from "@/features/locations/types";
import { createSupabaseServerClient } from "@/server/supabase/client";

type LocationRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  allowed_radius_meters: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

function mapLocation(row: LocationRow): AttendanceLocation {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    allowedRadiusMeters: row.allowed_radius_meters,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const select = "id,name,latitude,longitude,allowed_radius_meters,active,created_at,updated_at";

export const attendanceLocationRepository = {
  async list(): Promise<AttendanceLocation[]> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("attendance_locations")
      .select(select)
      .order("active", { ascending: false })
      .order("name");

    if (error) throw new Error(`No se pudieron consultar las ubicaciones: ${error.message}`);
    return ((data ?? []) as LocationRow[]).map(mapLocation);
  },

  async create(input: AttendanceLocationInput): Promise<string> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("attendance_locations")
      .insert({
        name: input.name,
        latitude: input.latitude,
        longitude: input.longitude,
        allowed_radius_meters: input.allowedRadiusMeters,
        active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(`No se pudo crear la ubicación: ${error.message}`);
    return data.id;
  },

  async update(id: string, input: AttendanceLocationInput): Promise<string | null> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("attendance_locations")
      .update({
        name: input.name,
        latitude: input.latitude,
        longitude: input.longitude,
        allowed_radius_meters: input.allowedRadiusMeters,
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`No se pudo actualizar la ubicación: ${error.message}`);
    return data?.id ?? null;
  },

  async setActive(id: string, active: boolean): Promise<boolean> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("attendance_locations")
      .update({ active })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`No se pudo cambiar el estado de la ubicación: ${error.message}`);
    return Boolean(data);
  },
};
