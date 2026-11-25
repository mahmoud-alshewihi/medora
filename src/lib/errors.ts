export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}
export const unauthorized = () => new AppError(401, "UNAUTHENTICATED", "Authentication required");
export const forbidden = (m = "You do not have permission to perform this action") => new AppError(403, "FORBIDDEN", m);
export const notFound = (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found`);
export const conflict = (code: string, m: string) => new AppError(409, code, m);
export const badRequest = (m: string, details?: unknown) => new AppError(400, "BAD_REQUEST", m, details);
