import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { requireAuth } from "./auth.middleware";
import {
  createIntegrationTokenForUser,
  loginWithEmailAndPassword,
  registerWithEmailAndPassword,
} from "./auth.service";

const authBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "password must have at least 6 characters"),
});

function parseAuthBody(body: unknown) {
  const parsed = authBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request payload",
    };
  }
  return { ok: true as const, data: parsed.data };
}

export const authRoutes = Router();

authRoutes.post("/register", async (req, res) => {
  const parsed = parseAuthBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ ok: false, error: parsed.error });
    return;
  }

  try {
    const result = await registerWithEmailAndPassword(parsed.data.email, parsed.data.password);
    res.status(201).json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.name === "EMAIL_ALREADY_EXISTS") {
      res.status(409).json({ ok: false, error: "Email already registered." });
      return;
    }
    res.status(500).json({ ok: false, error: "Internal server error." });
  }
});

authRoutes.post("/login", async (req, res) => {
  const parsed = parseAuthBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ ok: false, error: parsed.error });
    return;
  }

  try {
    const result = await loginWithEmailAndPassword(parsed.data.email, parsed.data.password);
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.name === "INVALID_CREDENTIALS") {
      res.status(401).json({ ok: false, error: "Invalid credentials." });
      return;
    }
    res.status(500).json({ ok: false, error: "Internal server error." });
  }
});

authRoutes.post("/integration-token", requireAuth, async (req, res) => {
  try {
    const authUserId = req.authUser?.id;
    if (!authUserId) {
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }
    const result = await createIntegrationTokenForUser(authUserId);
    res.status(200).json({
      ok: true,
      ...result,
      tokenType: "integration",
      expiresIn: env.JWT_INTEGRATION_EXPIRES_IN,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AUTH_USER_NOT_FOUND") {
      res.status(404).json({ ok: false, error: "Authenticated user not found." });
      return;
    }
    res.status(500).json({ ok: false, error: "Internal server error." });
  }
});
