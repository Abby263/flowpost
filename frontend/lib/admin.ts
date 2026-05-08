import "server-only";

/**
 * Admin role check.
 *
 * Admin user IDs are configured via env (Clerk user ids, comma-separated):
 *   ADMIN_USER_IDS                 - server-side check
 *   NEXT_PUBLIC_ADMIN_USER_IDS     - client-side nav visibility (mirror)
 *
 * Admins:
 *   - bypass all credit checks (workflow runs, post approvals, content ideas)
 *   - bypass plan-level limits when those become enforced
 *   - see the /admin dashboard
 *
 * If you set ADMIN_USER_IDS but forget the NEXT_PUBLIC_ mirror, the admin
 * link won't render in the sidebar but the API checks will still work — so
 * make a habit of setting both.
 */

export function getAdminUserIds(): string[] {
  return (
    process.env.ADMIN_USER_IDS?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) || []
  );
}

export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return getAdminUserIds().includes(userId);
}
