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

function signAccessToken(payload: AuthPayload): string {
  const signOptions: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
    subject: payload.id,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    ...signOptions,
  });
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
