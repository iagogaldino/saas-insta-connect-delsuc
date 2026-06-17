import type { Request } from "express";
import type { InstaConnect, LoginChallengeType, LoginResult } from "insta-connect-delsuc";
import { env } from "../../config/env";

export type ResolvedLoginChallenge = {
  challengeRequired: boolean;
  challengeType: LoginChallengeType;
};

export function resolveChallengeFromLoginResult(result: {
  url?: string;
  challengeRequired?: boolean;
  challengeType?: LoginChallengeType;
}): ResolvedLoginChallenge {
  const explicitChallenge = result.challengeRequired === true;
  const url = String(result.url || "").toLowerCase();
  const urlSuggestsChallenge =
    url.includes("/accounts/login/two_factor") ||
    url.includes("/accounts/two_factor") ||
    url.includes("/challenge/") ||
    url.includes("/auth_platform/");

  const challengeRequired = explicitChallenge || urlSuggestsChallenge;

  if (typeof result.challengeType === "string" && result.challengeType) {
    return { challengeRequired, challengeType: result.challengeType };
  }

  let challengeType: LoginChallengeType = "unknown";
  if (url.includes("recaptcha")) {
    challengeType = "recaptcha";
  } else if (url.includes("two_factor")) {
    challengeType = "two_factor";
  } else if (url.includes("/auth_platform/codeentry") || url.includes("/auth_platform/")) {
    challengeType = "email_code";
  } else if (url.includes("/challenge/")) {
    challengeType = "security_code";
  }

  return { challengeRequired, challengeType };
}

export function getPublicBaseUrl(req?: Request): string {
  const configured = env.PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  if (req) {
    const host = req.get("host");
    const forwardedProto = req.get("x-forwarded-proto");
    const proto = forwardedProto ? forwardedProto.split(",")[0]?.trim() : req.protocol;
    if (host) {
      return `${proto}://${host}`;
    }
  }
  return `http://127.0.0.1:${env.PORT}`;
}

export function buildChallengeAssistUrl(sessionId: string, req?: Request): string {
  const publicBaseUrl = getPublicBaseUrl(req);
  return `${publicBaseUrl}/insta/sessions/${encodeURIComponent(sessionId)}/challenge`;
}

export function buildLoginChallengePayload(
  client: InstaConnect,
  sessionId: string,
  challengeType: LoginChallengeType,
  req?: Request,
): {
  manualInteractionRequired: boolean;
  challengeAssistUrl?: string;
} {
  const manualInteractionRequired = client.isManualInteractionChallengeType(challengeType);
  if (!manualInteractionRequired) {
    return { manualInteractionRequired: false };
  }
  return {
    manualInteractionRequired: true,
    challengeAssistUrl: buildChallengeAssistUrl(sessionId, req),
  };
}

export function enrichLoginChallengeResponse(
  client: InstaConnect,
  sessionId: string,
  result: LoginResult,
  req?: Request,
): LoginResult & {
  challengeRequired?: boolean;
  challengeType: LoginChallengeType;
  manualInteractionRequired: boolean;
  challengeAssistUrl?: string;
} {
  const challengeInfo = resolveChallengeFromLoginResult(result);
  const extras = buildLoginChallengePayload(client, sessionId, challengeInfo.challengeType, req);
  return {
    ...result,
    challengeRequired: challengeInfo.challengeRequired,
    challengeType: challengeInfo.challengeType,
    ...extras,
  };
}
