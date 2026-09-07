import "server-only";

import { employeeRepository } from "./employee.repository";

export function getEmployees() {
  return employeeRepository.list();
}
