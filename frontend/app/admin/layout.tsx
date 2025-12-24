import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard | FlowPost",
  description:
    "Admin dashboard for FlowPost - View analytics, user data, and platform statistics",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
