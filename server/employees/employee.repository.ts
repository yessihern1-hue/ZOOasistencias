import "server-only";

import type { Employee } from "@/features/employees/types";

const employees: Employee[] = [
  { id: "usr-carlos", name: "Carlos Méndez", initials: "CM", avatarTone: "blue", email: "carlos@zoo.com", department: "Operaciones", position: "Coordinador", schedule: "08:00 – 17:00", status: "active" },
  { id: "usr-sofia", name: "Sofía Ramírez", initials: "SR", avatarTone: "purple", email: "sofia@zoo.com", department: "Administración", position: "Analista", schedule: "08:00 – 17:00", status: "active" },
  { id: "usr-diego", name: "Diego López", initials: "DL", avatarTone: "orange", email: "diego@zoo.com", department: "Mantenimiento", position: "Técnico", schedule: "08:00 – 17:00", status: "active" },
  { id: "usr-valeria", name: "Valeria Castillo", initials: "VC", avatarTone: "pink", email: "valeria@zoo.com", department: "Recursos Humanos", position: "Especialista", schedule: "08:00 – 17:00", status: "active" },
  { id: "usr-marco", name: "Marco Estrada", initials: "ME", avatarTone: "green", email: "marco@zoo.com", department: "Veterinaria", position: "Veterinario", schedule: "07:00 – 16:00", status: "vacation" },
  { id: "usr-lucia", name: "Lucía Herrera", initials: "LH", avatarTone: "purple", email: "lucia@zoo.com", department: "Educación", position: "Guía educativa", schedule: "09:00 – 18:00", status: "active" },
];

export const employeeRepository = {
  list() {
    return employees.map((employee) => ({ ...employee }));
  },
};
