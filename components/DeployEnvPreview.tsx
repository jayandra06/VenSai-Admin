"use client";

import { useState } from "react";
import { formatEnv, type EnvPair } from "@/lib/env";

export function DeployEnvPreview({ rows, title }: { rows: EnvPair[]; title?: string }) {
  const [copied, setCopied] = useState(false);
  const text = formatEnv(rows);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">{title ?? "Deploy .env (Vercel / Rofyt server)"}</p>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800">
        {text || "# Save settings to generate .env"}
      </pre>
    </div>
  );
}
