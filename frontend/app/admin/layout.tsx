import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard | FlowPost",
  description:
    "Admin dashboard for FlowPost - View analytics, user data, and platform statistics",
};

// Admin user IDs - checked server-side
const ADMIN_USER_IDS =
  process.env.ADMIN_USER_IDS?.split(",").map((id) => id.trim()) || [];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  // Redirect to dashboard if not logged in
  if (!userId) {
    redirect("/sign-in");
  }

  // Redirect to dashboard if not an admin
  if (!ADMIN_USER_IDS.includes(userId)) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
