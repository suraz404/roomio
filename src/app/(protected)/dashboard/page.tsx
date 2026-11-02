import { Suspense } from "react";
import { LogoutButton } from "@/components/login-button";
import { requireSession } from "@/lib/session";

async function DashboardContent() {
  const session = await requireSession();

  return (
    <main className="p-8">
      <h1>Roomio Dashboard</h1>
      <p>Welcome, {session.user.name}</p>
      <p>{session.user.email}</p>

      <LogoutButton />
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={<p className="p-8 text-sm text-slate-600">Loading...</p>}
    >
      <DashboardContent />
    </Suspense>
  );
}
