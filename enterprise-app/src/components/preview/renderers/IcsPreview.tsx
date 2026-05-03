"use client";

import { useEffect, useState } from "react";
import { fetchText } from "../fileUrl";
import type { PreviewFile } from "@/store/preview";
import { Loader2, Calendar, MapPin, User } from "lucide-react";

interface IcsEvent {
  summary?: string;
  description?: string;
  location?: string;
  start?: string;
  end?: string;
  organizer?: string;
  attendees?: string[];
}

function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let cur: IcsEvent | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT" && cur) { events.push(cur); cur = null; }
    else if (cur) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const keyPart = line.slice(0, idx);
      const value = line.slice(idx + 1).replace(/\\n/g, "\n");
      const key = keyPart.split(";")[0];
      switch (key) {
        case "SUMMARY": cur.summary = value; break;
        case "DESCRIPTION": cur.description = value; break;
        case "LOCATION": cur.location = value; break;
        case "DTSTART": cur.start = formatIcsDate(value); break;
        case "DTEND": cur.end = formatIcsDate(value); break;
        case "ORGANIZER": cur.organizer = value.replace(/^mailto:/i, ""); break;
        case "ATTENDEE": (cur.attendees ??= []).push(value.replace(/^mailto:/i, "")); break;
      }
    }
  }
  return events;
}

function formatIcsDate(s: string): string {
  // 20260601T140000 → 2026-06-01 14:00:00
  if (!s) return s;
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
  if (!m) return s;
  const [, y, mo, d, h, mi] = m;
  return h ? `${y}-${mo}-${d} ${h}:${mi}` : `${y}-${mo}-${d}`;
}

export function IcsPreview({ file }: { file: PreviewFile }) {
  const [events, setEvents] = useState<IcsEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchText(file).then((t) => setEvents(parseIcs(t))).catch((e) => setError(String(e)));
  }, [file]);

  if (error) return <div className="p-6 text-sm text-red-400">{error}</div>;
  if (!events) return (
    <div className="h-full w-full flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--pat-cream)" }} />
    </div>
  );

  return (
    <div className="h-full w-full overflow-auto p-6 space-y-4" style={{ background: "var(--pat-surface)" }}>
      {events.map((e, i) => (
        <div
          key={i}
          className="rounded-xl border p-5 space-y-3"
          style={{ background: "var(--pat-bg)", borderColor: "var(--pat-border)" }}
        >
          <h2 className="font-serif text-2xl" style={{ color: "var(--pat-text)" }}>{e.summary || "(untitled)"}</h2>
          {e.start && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--pat-cream)" }}>
              <Calendar className="h-4 w-4" />
              <span>{e.start}{e.end ? ` → ${e.end}` : ""}</span>
            </div>
          )}
          {e.location && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--pat-text)" }}>
              <MapPin className="h-4 w-4" />
              <span>{e.location}</span>
            </div>
          )}
          {e.organizer && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--pat-muted)" }}>
              <User className="h-3 w-3" />
              <span>Organizer: {e.organizer}</span>
            </div>
          )}
          {e.attendees && e.attendees.length > 0 && (
            <div className="text-xs" style={{ color: "var(--pat-muted)" }}>
              Attendees: {e.attendees.join(", ")}
            </div>
          )}
          {e.description && (
            <p className="text-sm whitespace-pre-wrap pt-2 border-t" style={{ color: "var(--pat-text)", borderColor: "var(--pat-border)" }}>
              {e.description}
            </p>
          )}
        </div>
      ))}
      {events.length === 0 && (
        <p style={{ color: "var(--pat-muted)" }}>No events found in this calendar file.</p>
      )}
    </div>
  );
}
