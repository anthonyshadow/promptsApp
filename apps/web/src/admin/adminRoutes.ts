import type { AdminActionScope } from "@promptopts/shared";

export type AdminRoute =
  | {
      kind: "overview";
    }
  | {
      kind: "accounts";
    }
  | {
      kind: "account-detail";
      accountId: string;
    }
  | {
      kind: "eval-jobs";
    }
  | {
      kind: "model-registry";
    }
  | {
      kind: "reports";
    }
  | {
      kind: "billing";
    }
  | {
      kind: "audit-logs";
    };

export function getAdminRoute(pathname: string): AdminRoute {
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] === "__admin" && parts[1] === "accounts" && parts[2]) {
    return {
      kind: "account-detail",
      accountId: decodeURIComponent(parts[2])
    };
  }

  if (parts[0] === "__admin" && parts[1] === "accounts") {
    return {
      kind: "accounts"
    };
  }

  if (parts[0] === "__admin" && parts[1] === "eval-jobs") {
    return {
      kind: "eval-jobs"
    };
  }

  if (parts[0] === "__admin" && parts[1] === "model-registry") {
    return {
      kind: "model-registry"
    };
  }

  if (parts[0] === "__admin" && parts[1] === "reports") {
    return {
      kind: "reports"
    };
  }

  if (parts[0] === "__admin" && parts[1] === "billing") {
    return {
      kind: "billing"
    };
  }

  if (parts[0] === "__admin" && parts[1] === "audit-logs") {
    return {
      kind: "audit-logs"
    };
  }

  return {
    kind: "overview"
  };
}

export function formatSudoAction(actionScope: AdminActionScope): string {
  return actionScope.replaceAll("_", " ");
}

export function formatExpiry(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
