import { NextResponse } from "next/server";
import { exportEverything } from "@/app/actions/settings";

// A full JSON dump. Your data should never be hostage to this app continuing to
// work, so the export is complete rather than a curated subset.

export async function GET() {
  const data = await exportEverything();
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="job-engine-backup-${stamp}.json"`,
    },
  });
}
