import { getAccessContext } from "@/server/auth/access";
import { homeFor } from "@/server/auth/permissions";
import { open } from "@/server/http/handler";

export const GET = open(async () => {
  const ctx = await getAccessContext();
  if (!ctx) return { authenticated: false };
  return { authenticated: true, name: ctx.userName, role: ctx.role, home: homeFor(ctx.role) };
});
