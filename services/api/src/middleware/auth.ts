import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Role } from "@prisma/client";

type AuthTokenPayload = JwtPayload & {
  sub: string;
  role: Role;
};

function sendAuthError(res: Response, status: number, message: string) {
  res.status(status).json({ ok: false, error: message });
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return sendAuthError(res, 401, "Unauthorized");
  }

  const token = header.slice("Bearer ".length).trim();
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return sendAuthError(res, 500, "JWT secret not configured");
  }

  try {
    const decoded = jwt.verify(token, secret) as AuthTokenPayload;
    if (!decoded?.sub || !decoded?.role) {
      return sendAuthError(res, 401, "Unauthorized");
    }

    req.user = { id: decoded.sub, role: decoded.role };
    return next();
  } catch {
    return sendAuthError(res, 401, "Unauthorized");
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendAuthError(res, 401, "Unauthorized");
    }

    if (!roles.includes(req.user.role)) {
      return sendAuthError(res, 403, "Forbidden");
    }

    return next();
  };
}
