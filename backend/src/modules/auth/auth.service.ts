import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";
import { UserModel } from "./user.model";

type AuthPayload = {
  id: string;
  email: string;
};

type AuthResponse = {
  token: string;
  user: AuthPayload;
};

function signToken(payload: AuthPayload, expiresIn: SignOptions["expiresIn"]): string {
  const signOptions: SignOptions = {
    expiresIn,
    subject: payload.id,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    ...signOptions,
  });
}

function signAccessToken(payload: AuthPayload): string {
  return signToken(payload, env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"]);
}

export function signIntegrationToken(payload: AuthPayload): string {
  return signToken(payload, env.JWT_INTEGRATION_EXPIRES_IN as SignOptions["expiresIn"]);
}

export async function registerWithEmailAndPassword(email: string, password: string): Promise<AuthResponse> {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await UserModel.findOne({ email: normalizedEmail }).lean();
  if (existing) {
    const error = new Error("Email already registered");
    error.name = "EMAIL_ALREADY_EXISTS";
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
  const user = await UserModel.create({ email: normalizedEmail, passwordHash });

  const payload: AuthPayload = {
    id: user._id.toString(),
    email: user.email,
  };

  return {
    token: signAccessToken(payload),
    user: payload,
  };
}

export async function loginWithEmailAndPassword(email: string, password: string): Promise<AuthResponse> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await UserModel.findOne({ email: normalizedEmail });
  if (!user) {
    const error = new Error("Invalid credentials");
    error.name = "INVALID_CREDENTIALS";
    throw error;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    const error = new Error("Invalid credentials");
    error.name = "INVALID_CREDENTIALS";
    throw error;
  }

  const payload: AuthPayload = {
    id: user._id.toString(),
    email: user.email,
  };

  return {
    token: signAccessToken(payload),
    user: payload,
  };
}

export async function createIntegrationTokenForUser(userId: string): Promise<AuthResponse> {
  const user = await UserModel.findById(userId).select("email").lean();
  if (!user) {
    const error = new Error("Authenticated user not found");
    error.name = "AUTH_USER_NOT_FOUND";
    throw error;
  }
  const payload: AuthPayload = {
    id: String(userId),
    email: user.email,
  };
  return {
    token: signIntegrationToken(payload),
    user: payload,
  };
}
