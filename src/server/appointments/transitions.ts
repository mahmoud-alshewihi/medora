import type { AppointmentStatus } from "@prisma/client";

export const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["WAITING", "IN_PROGRESS", "CANCELLED"],
  WAITING: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};
export const ACTIVE_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "WAITING", "IN_PROGRESS"];
export const canTransition = (from: AppointmentStatus, to: AppointmentStatus) => TRANSITIONS[from].includes(to);
