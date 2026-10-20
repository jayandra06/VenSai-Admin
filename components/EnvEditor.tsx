"use client";

import { useState } from "react";
import { formatEnv, normalizeEnvPairs, parseEnv, type EnvPair } from "@/lib/env";

export function EnvEditor({ pairs }: { pairs: EnvPair[] }) {
  const initial = normalizeEnvPairs(pairs);
  const [rows, setRows] = useState<EnvPair[]>(initial.length ? initial : [{ key: "", value: "" }]);
  const [paste, setPaste] = useState("");
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState("");

  function update(index: number, field: keyof EnvPair, value: string) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  }

  async function copyEnv() {
    const text = formatEnv(rows);
    try {
      await navigator.clipboard.writeText(text);
      setManual("");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setManual(text);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium text-slate-700" htmlFor="env-paste">
          Paste .env
        </label>
        <textarea
          id="env-paste"
          value={paste}
          onChange={(event) => setPaste(event.target.value)}
          placeholder={"MONGODB_URI=mongodb+srv://...\nAPP_URL=https://rofyt.example"}
          className="mt-1 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-[#3C50E0]"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const parsed = parseEnv(paste);
              if (parsed.length) setRows(parsed);
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Split into fields
          </button>
          <button
            type="button"
            onClick={copyEnv}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {copied ? "Copied" : "Copy .env"}
          </button>
        </div>
        {manual ? (
          <textarea
            readOnly
            value={manual}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
          />
        ) : null}
      </div>
      <div className="max-h-80 space-y-2 overflow-auto">
        {rows.map((row, index) => (
          <div key={index} className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
            <input
              name="envKey"
              value={row.key}
              onChange={(event) => update(index, "key", event.target.value)}
              placeholder="KEY"
              className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-[#3C50E0]"
            />
            <input
              name="envValue"
              value={row.value}
              onChange={(event) => update(index, "value", event.target.value)}
              placeholder="value"
              className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-[#3C50E0]"
            />
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
              className="rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setRows((current) => [...current, { key: "", value: "" }])}
        className="text-sm font-medium text-[#3C50E0]"
      >
        Add variable
      </button>
    </div>
  );
}
