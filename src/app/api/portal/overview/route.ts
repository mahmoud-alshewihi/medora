import { z } from "zod";
import { portalOverview } from "@/server/portal/service";
import { secured } from "@/server/http/handler";
void z;
export const GET = secured("portal.self", {}, async ({ ctx }) => portalOverview(ctx));
