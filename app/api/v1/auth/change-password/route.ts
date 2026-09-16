import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/dal";
import { createSupabaseServerClient } from "@/server/supabase/client";

const noStoreHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Tu sesión no es válida." }, { headers: noStoreHeaders, status: 401 });
    }
    if (!user.mustChangePassword) {
      return NextResponse.json({ error: "La contraseña temporal ya fue reemplazada." }, { headers: noStoreHeaders, status: 409 });
    }

    const body = (await request.json()) as { password?: unknown; confirmation?: unknown };
    if (
      typeof body.password !== "string" ||
      typeof body.confirmation !== "string" ||
      body.password.length < 8 ||
      body.password.length > 128
    ) {
      return NextResponse.json({ error: "La contraseña debe tener entre 8 y 128 caracteres." }, { headers: noStoreHeaders, status: 400 });
    }
    if (body.password !== body.confirmation) {
      return NextResponse.json({ error: "Las contraseñas no coinciden." }, { headers: noStoreHeaders, status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { error: passwordError } = await supabase.auth.updateUser({ password: body.password });
    if (passwordError) {
      return NextResponse.json({ error: "Supabase rechazó la contraseña. Utiliza una más segura." }, { headers: noStoreHeaders, status: 400 });
    }

    const { error: profileError } = await supabase.rpc("complete_password_change");
    if (profileError) throw profileError;

    return NextResponse.json({ success: true }, { headers: noStoreHeaders });
  } catch {
    return NextResponse.json({ error: "No se pudo completar el cambio de contraseña." }, { headers: noStoreHeaders, status: 500 });
  }
}
