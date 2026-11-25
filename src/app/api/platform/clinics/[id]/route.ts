import { z } from "zod";
import { requirePlatformAdmin } from "@/server/auth/access";
import { setClinicStatus, setSubscription } from "@/server/platform/service";
import { open } from "@/server/http/handler";

const body = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]).optional(), subscription: z.object({ planId: z.string(), status: z.enum(["TRIALING", "ACTIVE", "EXPIRED", "CANCELLED"]), expiresAt: z.string() }).optional() });
export const PATCH = open(async (req, params) => {
  const admin = await requirePlatformAdmin(); const b = body.parse(await req.json());
  if (b.status) await setClinicStatus(params.id!, b.status, admin.userId);
  if (b.subscription) await setSubscription(params.id!, { ...b.subscription, expiresAt: new Date(b.subscription.expiresAt) }, admin.userId);
  return { ok: true };
});
