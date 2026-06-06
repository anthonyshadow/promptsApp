import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type {
  AdminActionScope,
  AdminRoleRecord,
  AdminSessionRecord,
  AdminUserRecord,
  PromptOptsRepository,
  SudoRequest
} from "@promptopts/shared";
import {
  adminActionScopes,
  adminRoles,
  roleActionScopes,
  type AdminRole
} from "./scopes";
import type { AdminSession } from "./types";

export const ADMIN_SESSION_COOKIE_NAME = "promptopts_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const PRE_MFA_SESSION_TTL_MS = 10 * 60 * 1000;

export type AdminRequestMetadata = {
  ipAddress: string;
  userAgent: string;
};

export type CreatedAdminSession = {
  token: string;
  session: AdminSessionRecord;
};

export async function authenticateAdminPassword(
  repository: PromptOptsRepository,
  email: string,
  password: string
): Promise<AdminUserRecord | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const adminUser = (await repository.admin_users.list()).find(
    (user) => user.email.toLowerCase() === normalizedEmail && user.status === "active"
  );

  if (!adminUser || !verifyPasswordHash(password, adminUser.password_hash)) {
    return null;
  }

  return adminUser;
}

export async function createStoredAdminSession(
  repository: PromptOptsRepository,
  input: {
    adminUserId: string;
    metadata: AdminRequestMetadata;
    mfaVerified: boolean;
    now?: Date;
  }
): Promise<CreatedAdminSession> {
  const now = input.now ?? new Date();
  const token = createAdminSessionToken();
  const session: AdminSessionRecord = {
    id: createAdminAuthId("admin_session"),
    admin_user_id: input.adminUserId,
    session_hash: hashAdminSessionToken(token),
    mfa_verified_at: input.mfaVerified ? now.toISOString() : null,
    revoked_at: null,
    expires_at: new Date(
      now.getTime() + (input.mfaVerified ? SESSION_TTL_MS : PRE_MFA_SESSION_TTL_MS)
    ).toISOString(),
    ip_address: input.metadata.ipAddress,
    user_agent: input.metadata.userAgent,
    created_at: now.toISOString()
  };

  await repository.admin_sessions.create(session);

  return { token, session };
}

export async function rotateAdminSessionAfterMfa(
  repository: PromptOptsRepository,
  currentSessionId: string,
  metadata: AdminRequestMetadata
): Promise<CreatedAdminSession | null> {
  const currentSession = await repository.admin_sessions.get(currentSessionId);
  if (!currentSession || currentSession.revoked_at || Date.parse(currentSession.expires_at) <= Date.now()) {
    return null;
  }

  const now = new Date();
  await repository.admin_sessions.update(currentSession.id, {
    revoked_at: now.toISOString()
  });

  return createStoredAdminSession(repository, {
    adminUserId: currentSession.admin_user_id,
    metadata,
    mfaVerified: true,
    now
  });
}

export async function revokeAdminSession(
  repository: PromptOptsRepository,
  sessionId: string,
  now = new Date()
): Promise<void> {
  await repository.admin_sessions.update(sessionId, {
    revoked_at: now.toISOString()
  });
}

export async function revokeAdminUserSessions(
  repository: PromptOptsRepository,
  adminUserId: string,
  now = new Date()
): Promise<number> {
  const sessions = await repository.admin_sessions.list();
  let revokedCount = 0;

  for (const session of sessions) {
    if (
      session.admin_user_id === adminUserId &&
      !session.revoked_at &&
      Date.parse(session.expires_at) > now.getTime()
    ) {
      await repository.admin_sessions.update(session.id, {
        revoked_at: now.toISOString()
      });
      revokedCount += 1;
    }
  }

  return revokedCount;
}

export async function resolveAdminSession(
  repository: PromptOptsRepository,
  token: string | undefined,
  metadata: AdminRequestMetadata
): Promise<AdminSession | null> {
  if (!token) {
    return null;
  }

  const tokenHash = hashAdminSessionToken(token);
  const sessionRecord = (await repository.admin_sessions.list()).find(
    (session) => session.session_hash === tokenHash
  );

  if (
    !sessionRecord ||
    sessionRecord.revoked_at ||
    Date.parse(sessionRecord.expires_at) <= Date.now()
  ) {
    return null;
  }

  const adminUser = await repository.admin_users.get(sessionRecord.admin_user_id);
  if (!adminUser || adminUser.status !== "active") {
    return null;
  }

  const roles = await resolveAdminRoleRecords(repository, adminUser.role_ids);
  const role = chooseAdminRole(roles);
  if (!role) {
    return null;
  }

  return {
    session_id: sessionRecord.id,
    admin_user_id: adminUser.id,
    role,
    mfa_verified: Boolean(sessionRecord.mfa_verified_at),
    mfa_verified_at: sessionRecord.mfa_verified_at,
    expires_at: sessionRecord.expires_at,
    action_scopes: resolveActionScopes(role, roles),
    sudo_grant: await findActiveSudoGrant(repository, adminUser.id),
    ip_address: metadata.ipAddress || sessionRecord.ip_address,
    user_agent: metadata.userAgent || sessionRecord.user_agent,
    is_mock: false
  };
}

export async function findActiveSudoGrant(
  repository: PromptOptsRepository,
  adminUserId: string,
  actionScope?: AdminActionScope
): Promise<AdminSession["sudo_grant"]> {
  const now = Date.now();
  const matchingRequests = (await repository.sudo_requests.list())
    .filter((request) =>
      request.admin_user_id === adminUserId &&
      request.status === "approved" &&
      Date.parse(request.expires_at) > now &&
      (!actionScope || request.action_scope === actionScope)
    )
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
  const request = matchingRequests[0];

  if (!request) {
    return null;
  }

  return sudoRequestToGrant(request);
}

export async function verifyAdminTotp(
  repository: PromptOptsRepository,
  adminUserId: string,
  code: string
): Promise<boolean> {
  const adminUser = await repository.admin_users.get(adminUserId);
  return adminUser ? verifyTotpCode(adminUser.mfa_secret, code) : false;
}

export function hashAdminSessionToken(token: string): string {
  return `sha256:${createHash("sha256").update(token).digest("hex")}`;
}

export function createAdminSessionToken(): string {
  return `pa_${randomBytes(32).toString("base64url")}`;
}

export function createAdminAuthId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function verifyPasswordHash(password: string, passwordHash: string): boolean {
  const [algorithm, expectedDigest] = passwordHash.split(":");

  if (algorithm !== "sha256" || !expectedDigest) {
    return false;
  }

  const actualDigest = createHash("sha256").update(password).digest("hex");
  return safeStringEqual(actualDigest, expectedDigest);
}

export function createTotpCode(secret: string, timestamp = Date.now()): string {
  const key = decodeBase32(secret);
  const counter = Math.floor(timestamp / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const binary =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
    (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
    ((hmac[offset + 3] ?? 0) & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotpCode(secret: string, code: string, timestamp = Date.now()): boolean {
  const normalizedCode = code.trim();
  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  return [-30_000, 0, 30_000].some((offsetMs) =>
    safeStringEqual(createTotpCode(secret, timestamp + offsetMs), normalizedCode)
  );
}

function sudoRequestToGrant(request: SudoRequest): AdminSession["sudo_grant"] {
  return {
    request_id: request.id,
    reason_code: request.reason_code,
    expires_at: request.expires_at,
    action_scope: request.action_scope
  };
}

async function resolveAdminRoleRecords(
  repository: PromptOptsRepository,
  roleIds: string[]
): Promise<AdminRoleRecord[]> {
  const roles = await Promise.all(roleIds.map((roleId) => repository.admin_roles.get(roleId)));
  return roles.filter((role): role is AdminRoleRecord => Boolean(role));
}

function chooseAdminRole(roles: AdminRoleRecord[]): AdminRole | null {
  for (const role of adminRoles) {
    if (roles.some((candidate) => candidate.name === role)) {
      return role;
    }
  }

  return null;
}

function resolveActionScopes(role: AdminRole, roles: AdminRoleRecord[]): AdminActionScope[] {
  const allowed = new Set(roleActionScopes[role]);
  const scopes = new Set<AdminActionScope>();

  for (const record of roles) {
    for (const scope of record.scopes) {
      if ((adminActionScopes as readonly string[]).includes(scope) && allowed.has(scope)) {
        scopes.add(scope);
      }
    }
  }

  return Array.from(scopes);
}

function decodeBase32(secret: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = secret.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of cleaned) {
    const index = alphabet.indexOf(char);
    if (index < 0) {
      continue;
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function safeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
