import { redirect } from "next/navigation";

import { getUserEntryPath } from "@/features/auth/navigation";
import { getCurrentUser } from "@/server/auth/dal";

export default async function HomePage() {
  const user = await getCurrentUser();

  redirect(user ? getUserEntryPath(user) : "/login");
}
