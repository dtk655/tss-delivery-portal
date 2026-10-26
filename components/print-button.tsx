"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print route sheet" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-ink inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold">
      <Printer className="size-4" /> {label}
    </button>
  );
}
