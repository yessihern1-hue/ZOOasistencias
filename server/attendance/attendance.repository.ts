import "server-only";

import type { AttendanceRecord } from "@/features/attendance/types";
import { getDateKey } from "@/server/shared/date";

const seedRecords: AttendanceRecord[] = [
  {
    id: "att-001",
    employeeId: "usr-carlos",
    employeeName: "Carlos Méndez",
    initials: "CM",
    avatarTone: "blue",
    department: "Operaciones",
    schedule: "08:00 – 17:00",
    checkIn: "07:54",
    checkOut: null,
    status: "present",
  },
  {
    id: "att-002",
    employeeId: "usr-sofia",
    employeeName: "Sofía Ramírez",
    initials: "SR",
    avatarTone: "purple",
    department: "Administración",
    schedule: "08:00 – 17:00",
    checkIn: "08:03",
    checkOut: null,
    status: "present",
  },
  {
    id: "att-003",
    employeeId: "usr-diego",
    employeeName: "Diego López",
    initials: "DL",
    avatarTone: "orange",
    department: "Mantenimiento",
    schedule: "08:00 – 17:00",
    checkIn: "08:24",
    checkOut: null,
    status: "late",
  },
  {
    id: "att-004",
    employeeId: "usr-valeria",
    employeeName: "Valeria Castillo",
    initials: "VC",
    avatarTone: "pink",
    department: "Recursos Humanos",
    schedule: "08:00 – 17:00",
    checkIn: "07:58",
    checkOut: null,
    status: "present",
  },
  {
    id: "att-005",
    employeeId: "usr-marco",
    employeeName: "Marco Estrada",
    initials: "ME",
    avatarTone: "green",
    department: "Veterinaria",
    schedule: "07:00 – 16:00",
    checkIn: null,
    checkOut: null,
    status: "absent",
  },
];

type DemoStore = Map<string, AttendanceRecord[]>;

const globalStore = globalThis as typeof globalThis & {
  __zooAttendanceStore?: DemoStore;
};

function getStore() {
  globalStore.__zooAttendanceStore ??= new Map();
  return globalStore.__zooAttendanceStore;
}

function cloneRecords(records: AttendanceRecord[]) {
  return records.map((record) => ({ ...record }));
}

function ensureDay(dateKey = getDateKey()) {
  const store = getStore();

  if (!store.has(dateKey)) {
    store.set(dateKey, cloneRecords(seedRecords));
  }

  return store.get(dateKey)!;
}

export const attendanceRepository = {
  listByDate(dateKey = getDateKey()) {
    return cloneRecords(ensureDay(dateKey));
  },

  findByEmployee(employeeId: string, dateKey = getDateKey()) {
    const record = ensureDay(dateKey).find((item) => item.employeeId === employeeId);
    return record ? { ...record } : null;
  },

  save(record: AttendanceRecord, dateKey = getDateKey()) {
    const records = ensureDay(dateKey);
    const index = records.findIndex((item) => item.employeeId === record.employeeId);

    if (index >= 0) records[index] = { ...record };
    else records.unshift({ ...record });

    return { ...record };
  },
};
