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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ ok: false, error: "Missing or invalid Authorization header." });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
    if (!decoded.id || !decoded.email) {
      res.status(401).json({ ok: false, error: "Invalid token payload." });
      return;
    }
    req.authUser = {
      id: decoded.id,
      email: decoded.email,
    };
    next();
  } catch {
    res.status(401).json({ ok: false, error: "Invalid or expired token." });
  }
}
