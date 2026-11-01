import { Suspense } from "react";
import { requireSession } from "@/lib/session";

async function ProtectedContent({ children }: { children: React.ReactNode }) {
  await requireSession();

  return <>{children}</>;
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />

            <p className="text-sm font-medium text-slate-600">
              Loading your workspace...
            </p>
          </div>
        </main>
      }
    >
      <ProtectedContent>{children}</ProtectedContent>
    </Suspense>
  );
}
