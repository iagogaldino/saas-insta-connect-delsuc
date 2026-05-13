import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";

type TokenPayload = {
  id: string;
  email: string;
  sub?: string;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        email: string;
      };
    }
  }
}

export type AuthUserPayload = {
  id: string;
  email: string;
};

/** Token cru (sem prefixo `Bearer`). */
export function parseBearerToken(authorization: string): string | null {
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
}

export function verifyAccessToken(token: string | null | undefined): AuthUserPayload | null {
  if (!token) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
    if (!decoded.id || !decoded.email) {
      return null;
    }
    return {
      id: decoded.id,
      email: decoded.email,
    };
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = parseBearerToken(req.header("authorization") ?? "");
  const user = verifyAccessToken(token);
  if (!user) {
    res.status(401).json({ ok: false, error: "Missing or invalid Authorization header." });
    return;
  }
  req.authUser = user;
  next();
}
