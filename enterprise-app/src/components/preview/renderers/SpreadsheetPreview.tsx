"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { fetchBuffer, fetchText } from "../fileUrl";
import type { PreviewFile } from "@/store/preview";
import { Loader2 } from "lucide-react";

export function SpreadsheetPreview({ file }: { file: PreviewFile }) {
  const [sheets, setSheets] = useState<Array<{ name: string; rows: (string | number | boolean | null)[][] }> | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ext = (file.filename.split(".").pop() ?? "").toLowerCase();
        const isCsv = ext === "csv" || ext === "tsv";
        if (isCsv) {
          const text = await fetchText(file);
          const sep = ext === "tsv" ? "\t" : ",";
          const rows = text.split("\n").map((line) => parseCsvLine(line, sep));
          setSheets([{ name: ext.toUpperCase(), rows }]);
        } else {
          const buf = await fetchBuffer(file);
          const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
          const all = wb.SheetNames.map((n) => ({
            name: n,
            rows: XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(wb.Sheets[n], { header: 1, defval: "" }),
          }));
          setSheets(all);
        }
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [file]);

  if (error) return <div className="p-6 text-sm text-red-400">{error}</div>;
  if (!sheets) return (
    <div className="h-full w-full flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--pat-cream)" }} />
    </div>
  );

  const sheet = sheets[activeSheet];

  return (
    <div className="h-full w-full flex flex-col" style={{ background: "var(--pat-bg)" }}>
      {sheets.length > 1 && (
        <div className="flex gap-1 px-3 py-2 border-b" style={{ borderColor: "var(--pat-border)" }}>
          {sheets.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveSheet(i)}
              className="px-3 py-1 rounded text-xs transition-colors"
              style={{
                background: i === activeSheet ? "var(--pat-cream-20)" : "transparent",
                color: i === activeSheet ? "var(--pat-cream)" : "var(--pat-muted)",
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse text-xs font-mono">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="px-2 py-1 border" style={{ background: "var(--pat-surface)", borderColor: "var(--pat-border)", color: "var(--pat-muted)" }}></th>
              {(sheet.rows[0] ?? []).map((_, i) => (
                <th
                  key={i}
                  className="px-2 py-1 border text-left"
                  style={{ background: "var(--pat-surface)", borderColor: "var(--pat-border)", color: "var(--pat-muted)", minWidth: 80 }}
                >
                  {colLetter(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, ri) => (
              <tr key={ri}>
                <td
                  className="px-2 py-1 border text-right"
                  style={{ background: "var(--pat-surface)", borderColor: "var(--pat-border)", color: "var(--pat-muted)" }}
                >
                  {ri + 1}
                </td>
                {(sheet.rows[0] ?? []).map((_, ci) => (
                  <td
                    key={ci}
                    className="px-2 py-1 border whitespace-nowrap"
                    style={{ borderColor: "var(--pat-border)", color: "var(--pat-text)" }}
                  >
                    {String(row[ci] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function colLetter(i: number): string {
  let s = "";
  i = i + 1;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; }
      } else { cur += c; }
    } else {
      if (c === '"') inQ = true;
      else if (c === sep) { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}
