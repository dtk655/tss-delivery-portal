"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

export function CopyLink({ url, label = "Copy driver link" }: { url: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        } catch {
          window.prompt("Copy this link", url);
        }
      }}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 hover:border-stone-300"
    >
      {done ? <Check className="size-4 text-[#15803d]" /> : <Link2 className="size-4" />}
      {done ? "Copied" : label}
    </button>
  );
}
