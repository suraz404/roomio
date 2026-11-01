import { requireSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await requireSession();
  return (
    <main>
      <h1>Roomio Dashboard</h1>
      <p>Welcome, {session.user.name}</p>
      <p>{session.user.email}</p>
    </main>
  );
}
