import { Nav } from "@/components/Nav";
import { aiMode } from "@/lib/ai/client";
import { prisma } from "@/lib/db";

// Everything reads live from the local database, so nothing here should be
// statically cached between requests.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const mode = aiMode();
  const pendingBridge =
    mode === "BRIDGE"
      ? await prisma.aiCall.count({ where: { status: "PENDING", mode: "BRIDGE" } })
      : 0;

  return (
    <div className="flex h-dvh overflow-hidden">
      <Nav aiMode={mode} pendingBridge={pendingBridge} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
