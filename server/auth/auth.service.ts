import "server-only";

import type { SessionUser } from "@/features/auth/types";

type DemoAccount = SessionUser & { password: string };

const demoAccounts: DemoAccount[] = [
  {
    id: "91a20e2c-361e-460f-a12f-fa152a1df912",
    name: "Andrea Morales",
    email: "admin@zoo.com",
    password: "demo123",
    role: "admin",
    roleLabel: "Administradora",
    initials: "AM",
  },
];

export function authenticate(
  email: string,
  password: string
): SessionUser | null {
  const normalizedEmail = email.trim().toLowerCase();

  const account = demoAccounts.find(
    (candidate) =>
      candidate.email === normalizedEmail &&
      candidate.password === password
  );

  if (!account) return null;

  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    roleLabel: account.roleLabel,
    initials: account.initials,
  };
}