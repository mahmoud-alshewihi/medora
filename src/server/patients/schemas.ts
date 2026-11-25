import { z } from "zod";

export const patientInput = z.object({
  fullName: z.string().trim().min(2).max(120),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  phone: z.string().trim().min(6).max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("").transform(() => null)),
  nationalId: z.string().trim().max(30).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  emergencyContactName: z.string().max(120).optional().nullable(),
  emergencyContactPhone: z.string().max(30).optional().nullable(),
  emergencyContactRelation: z.string().max(60).optional().nullable(),
  allergies: z.array(z.string().max(80)).max(30).optional(),
  chronicConditions: z.array(z.string().max(80)).max(30).optional(),
  medicalHistory: z.string().max(5000).optional().nullable(),
});
export type PatientInput = z.infer<typeof patientInput>;

export const patientQuery = z.object({
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["fullName", "createdAt", "mrn"]).default("createdAt"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  archived: z.enum(["true", "false"]).default("false"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
});
