import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/server/notifications/providers";

export const auth = betterAuth({
  secret: env().BETTER_AUTH_SECRET,
  baseURL: env().BETTER_AUTH_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: env().EMAIL_VERIFICATION_REQUIRED === "true",
    sendResetPassword: async ({ user, url }) => {
      const r = await sendEmail({ to: user.email, subject: "Reset your Medora password", text: `Reset link: ${url}` });
      logger.info("password reset requested", { delivered: r.delivered, provider: r.provider });
      if (!r.delivered && env().NODE_ENV !== "production") console.log(`[dev] password reset link for ${user.email}: ${url}`);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      const r = await sendEmail({ to: user.email, subject: "Verify your Medora email", text: `Verify: ${url}` });
      logger.info("verification email", { delivered: r.delivered, provider: r.provider });
      if (!r.delivered && env().NODE_ENV !== "production") console.log(`[dev] verification link for ${user.email}: ${url}`);
    },
  },
  user: { additionalFields: { status: { type: "string", required: false, input: false }, locale: { type: "string", required: false } } },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
  advanced: { useSecureCookies: env().NODE_ENV === "production", defaultCookieAttributes: { httpOnly: true, sameSite: "lax" } },
  rateLimit: { enabled: true, window: 60, max: 30, customRules: { "/sign-in/email": { window: 60, max: 10 } } },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const u = await db.user.findUnique({ where: { id: session.userId }, select: { status: true } });
          if (!u || u.status !== "ACTIVE") return false; // suspended accounts cannot sign in
          return { data: session };
        },
      },
    },
  },
  plugins: [nextCookies()],
});
