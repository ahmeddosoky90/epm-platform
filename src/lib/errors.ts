export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}
export const notFound = (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found`);
export const forbidden = (msg = "You do not have permission to perform this action") => new AppError(403, "FORBIDDEN", msg);
export const unauthorized = () => new AppError(401, "UNAUTHENTICATED", "Sign in required");
export const badRequest = (msg: string, details?: unknown) => new AppError(400, "BAD_REQUEST", msg, details);
export const conflict = (msg: string) => new AppError(409, "CONFLICT", msg);
