"use client";

import { useEffect } from "react";

/** Opens the print dialog once the page has rendered. */
export function PrintTrigger() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="no-print mb-6 flex items-center justify-between gap-4 rounded-md border border-black/15 bg-black/[0.03] px-4 py-2.5 text-[10pt]">
      <span>
        Choose <strong>Save as PDF</strong> as the destination. Text stays selectable, which is what keeps it
        machine-readable.
      </span>
      <button
        onClick={() => window.print()}
        className="shrink-0 rounded border border-black/25 px-2.5 py-1 font-medium"
      >
        Print
      </button>
    </div>
  );
}
