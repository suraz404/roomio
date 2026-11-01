import { requireSession } from "@/lib/session";

export const instant = false;

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return <>{children}</>;
}
