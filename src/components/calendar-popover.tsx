"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysIsoDate, toIsoDate } from "@/lib/local-date";

function monthDays(month: string) {
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day >= 1 && day <= days ? `${year}-${String(number).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
  });
}

function moveMonth(month: string, offset: number) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

function localToday() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const dayLabel = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const monthLabel = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", month: "long", year: "numeric" });

export function CalendarPopover({ label, value, minIsoDate, close, select }: {
  label: string; value: string; minIsoDate?: string; close: () => void; select: (iso: string) => void;
}) {
  const current = toIsoDate(value);
  const initial = current && (!minIsoDate || current >= minIsoDate) ? current : minIsoDate ?? localToday();
  const [active, setActive] = useState(initial);
  const [month, setMonth] = useState(initial.slice(0, 7));
  const dayRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => { requestAnimationFrame(() => dayRefs.current[active]?.focus()); }, [active, month]);
  function move(delta: number) {
    const next = addDaysIsoDate(active, delta);
    if (minIsoDate && next < minIsoDate) return;
    setActive(next); setMonth(next.slice(0, 7));
  }
  const previous = moveMonth(month, -1);
  const previousMonthLastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 0)).toISOString().slice(0, 10);

  return <div className="calendar-popover" role="dialog" aria-label={`Calendario de ${label}`} onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
      if (!(event.target instanceof HTMLButtonElement) || !event.target.dataset.date) return;
      event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -7 : 7);
    }
  }}>
    <div className="calendar-header"><button type="button" className="btn" aria-label="Mes anterior" disabled={!!minIsoDate && previousMonthLastDay < minIsoDate} onClick={() => { setMonth(previous); const candidate = `${previous}-01`; setActive(minIsoDate && candidate < minIsoDate ? minIsoDate : candidate); }}><ChevronLeft size={18} aria-hidden="true" /></button><strong aria-live="polite">{monthLabel.format(new Date(`${month}-01T00:00:00.000Z`))}</strong><button type="button" className="btn" aria-label="Mes siguiente" onClick={() => { const next = moveMonth(month, 1); setMonth(next); setActive(`${next}-01`); }}><ChevronRight size={18} aria-hidden="true" /></button></div>
    <div className="calendar-days">{["L", "M", "X", "J", "V", "S", "D"].map((day, index) => <span className="muted small" aria-hidden="true" key={`${day}-${index}`}>{day}</span>)}
      {monthDays(month).map((iso, index) => iso ? <button ref={(element) => { dayRefs.current[iso] = element; }} className="calendar-day" data-date={iso} type="button" key={iso} disabled={!!minIsoDate && iso < minIsoDate} tabIndex={iso === active ? 0 : -1} aria-label={dayLabel.format(new Date(`${iso}T00:00:00.000Z`))} aria-pressed={iso === current} onClick={() => select(iso)}>{Number(iso.slice(8))}</button> : <span key={`empty-${index}`} aria-hidden="true" />)}
    </div>
  </div>;
}
