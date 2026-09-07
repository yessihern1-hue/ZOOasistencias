import type { ReactNode } from "react";

import { AppShell } from "@/features/layout/components/app-shell";
import { requireUser } from "@/server/auth/dal";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return <AppShell user={user}>{children}</AppShell>;
}
