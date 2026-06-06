import { Hono, type Context } from "hono";
import {
  ADMIN_SESSION_COOKIE_NAME,
  authenticateAdminPassword,
  canUseActionScope,
  createStoredAdminSession,
  endSudoRequests,
  getSudoStatus,
  requireAdminRole,
  requireMfa,
  requireSession,
  revokeAdminSession,
  rotateAdminSessionAfterMfa,
  startSudoRequest,
  verifyAdminTotp
} from "@promptopts/admin-core";
import {
  adminAuthLoginRequestSchema,
  adminAuthLogoutResponseSchema,
  adminAuthMeResponseSchema,
  adminAuthMfaRequestSchema,
  adminAuthSessionResponseSchema,
  adminSudoEndRequestSchema,
  adminSudoEndResponseSchema,
  adminSudoStartRequestSchema,
  adminSudoStartResponseSchema,
  adminSudoStatusResponseSchema
} from "../contracts";
import type { ApiEnv } from "../context";
import { validateJson } from "../http";

export function createAdminAuthRoutes() {
  return new Hono<ApiEnv>()
    .post("/auth/login", async (c) => {
      const body = await validateJson(c, adminAuthLoginRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const adminUser = await authenticateAdminPassword(
        c.var.repository,
        body.data.email,
        body.data.password
      );
      if (!adminUser) {
        return adminAuthError(c, 401, "invalid_credentials", "Invalid admin credentials");
      }

      const created = await createStoredAdminSession(c.var.repository, {
        adminUserId: adminUser.id,
        metadata: readAdminRequestMetadata(c),
        mfaVerified: false
      });
      writeAdminSessionCookie(c, created.token, created.session.expires_at);

      return c.json(
        adminAuthSessionResponseSchema.parse({
          token: created.token,
          session: {
            id: created.session.id,
            admin_user_id: adminUser.id,
            role: null,
            mfa_required: true,
            mfa_verified: false,
            expires_at: created.session.expires_at
          }
        })
      );
    })
    .post("/auth/mfa/verify", requireSession, async (c) => {
      const body = await validateJson(c, adminAuthMfaRequestSchema);
      if (!body.success) {
        return body.response;
      }

      if (!(await verifyAdminTotp(c.var.repository, c.var.adminSession.admin_user_id, body.data.code))) {
        return adminAuthError(c, 403, "mfa_invalid", "Invalid MFA code");
      }

      const rotated = await rotateAdminSessionAfterMfa(
        c.var.repository,
        c.var.adminSession.session_id,
        readAdminRequestMetadata(c)
      );
      if (!rotated) {
        return adminAuthError(c, 401, "session_expired", "Admin session expired");
      }

      writeAdminSessionCookie(c, rotated.token, rotated.session.expires_at);

      return c.json(
        adminAuthSessionResponseSchema.parse({
          token: rotated.token,
          session: {
            id: rotated.session.id,
            admin_user_id: rotated.session.admin_user_id,
            role: c.var.adminSession.role,
            mfa_required: false,
            mfa_verified: true,
            expires_at: rotated.session.expires_at
          }
        })
      );
    })
    .get("/auth/me", requireSession, async (c) => {
      return c.json(
        adminAuthMeResponseSchema.parse({
          authenticated: true,
          admin_user_id: c.var.adminSession.admin_user_id,
          role: c.var.adminSession.role,
          mfa_verified: c.var.adminSession.mfa_verified,
          action_scopes: c.var.adminSession.action_scopes,
          expires_at: c.var.adminSession.expires_at
        })
      );
    })
    .post("/auth/logout", requireSession, async (c) => {
      await revokeAdminSession(c.var.repository, c.var.adminSession.session_id);
      expireAdminSessionCookie(c);

      return c.json(adminAuthLogoutResponseSchema.parse({ signed_out: true }));
    })
    .get("/sudo/status", requireSession, requireMfa, requireAdminRole, async (c) => {
      return c.json(
        adminSudoStatusResponseSchema.parse(
          formatSudoStatus(await getSudoStatus(c.var.repository, c.var.adminSession))
        )
      );
    })
    .post("/sudo/start", requireSession, requireMfa, requireAdminRole, async (c) => {
      const body = await validateJson(c, adminSudoStartRequestSchema);
      if (!body.success) {
        return body.response;
      }

      if (!(await verifyAdminTotp(c.var.repository, c.var.adminSession.admin_user_id, body.data.mfa_code))) {
        return adminAuthError(c, 403, "mfa_invalid", "Invalid MFA code");
      }

      if (!canUseActionScope(c.var.adminSession, body.data.action_scope)) {
        return adminAuthError(c, 403, "action_scope_required", "Admin action scope required");
      }

      const sudoRequest = await startSudoRequest(c.var.repository, {
        session: c.var.adminSession,
        actionScope: body.data.action_scope,
        reasonCode: body.data.reason_code,
        targetType: body.data.target_type ?? null,
        targetId: body.data.target_id ?? null,
        metadata: readAdminRequestMetadata(c)
      });

      return c.json(
        adminSudoStartResponseSchema.parse({
          sudo_request: sudoRequest,
          status: formatSudoStatus(await getSudoStatus(c.var.repository, c.var.adminSession))
        }),
        201
      );
    })
    .post("/sudo/end", requireSession, requireMfa, requireAdminRole, async (c) => {
      const body = await validateJson(c, adminSudoEndRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const revokeInput = {
        session: c.var.adminSession,
        reasonCode: body.data.reason_code
      };
      const revoked = await endSudoRequests(
        c.var.repository,
        body.data.action_scope
          ? {
              ...revokeInput,
              actionScope: body.data.action_scope
            }
          : revokeInput
      );

      return c.json(
        adminSudoEndResponseSchema.parse({
          revoked,
          status: formatSudoStatus(await getSudoStatus(c.var.repository, c.var.adminSession))
        })
      );
    });
}

function adminAuthError(
  c: Context<ApiEnv>,
  status: 401 | 403,
  code: string,
  message: string
): Response {
  return c.json(
    {
      error: {
        code,
        message
      }
    },
    status
  );
}

function readAdminRequestMetadata(c: Context<ApiEnv>) {
  return {
    ipAddress:
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("cf-connecting-ip") ??
      "127.0.0.1",
    userAgent: c.req.header("user-agent") ?? "unknown"
  };
}

function writeAdminSessionCookie(c: Context<ApiEnv>, token: string, expiresAt: string): void {
  c.header(
    "set-cookie",
    serializeAdminSessionCookie(token, {
      expiresAt,
      expired: false
    })
  );
}

function expireAdminSessionCookie(c: Context<ApiEnv>): void {
  c.header(
    "set-cookie",
    serializeAdminSessionCookie("", {
      expiresAt: new Date(0).toISOString(),
      expired: true
    })
  );
}

function serializeAdminSessionCookie(
  token: string,
  options: {
    expiresAt: string;
    expired: boolean;
  }
): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = options.expired ? 0 : Math.max(0, Math.floor((Date.parse(options.expiresAt) - Date.now()) / 1000));

  return [
    `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    `Expires=${new Date(options.expiresAt).toUTCString()}${secure}`
  ].join("; ");
}

function formatSudoStatus(status: Awaited<ReturnType<typeof getSudoStatus>>) {
  const activeUntil = status.active
    .map((request) => request.expires_at)
    .sort()
    .at(-1) ?? null;

  return {
    ...status,
    active_until: activeUntil
  };
}
