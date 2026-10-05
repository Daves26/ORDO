"use client";
import { useEffect, useId, useRef, useState } from "react";
import { CalendarPopover } from "@/components/calendar-popover";
import { formatDateInput, fromIsoDate, toIsoDate } from "@/lib/local-date";

type Props = {
  id: string; label: string; value: string; onChange: (display: string) => void;
  calendar?: boolean; calendarOpen?: boolean; onCalendarOpenChange?: (open: boolean) => void;
  minIsoDate?: string; onCalendarSelect?: (iso: string) => void; disabled?: boolean; required?: boolean;
};

export function DateField({ id, label, value, onChange, calendar = true, calendarOpen, onCalendarOpenChange, minIsoDate, onCalendarSelect, disabled = false, required = false }: Props) {
  const [touched, setTouched] = useState(false);
  const [ownOpen, setOwnOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageId = useId();
  const parsed = value && toIsoDate(value);
  const tooEarly = !!parsed && !!minIsoDate && parsed < minIsoDate;
  const invalid = tooEarly || (touched && !!value && !parsed);
  const open = calendarOpen ?? ownOpen;
  function setOpen(next: boolean) {
    if (calendarOpen === undefined) setOwnOpen(next);
    onCalendarOpenChange?.(next);
  }
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, calendarOpen, onCalendarOpenChange]);

  return <div ref={wrapper} className="field"><label htmlFor={id}>{label}</label>
    <input ref={inputRef} id={id} type="text" inputMode="numeric" autoComplete="off" placeholder="DD/MM/AAAA" maxLength={10} disabled={disabled} required={required} aria-invalid={invalid || undefined} aria-describedby={invalid ? messageId : undefined} aria-haspopup={calendar ? "dialog" : undefined} aria-expanded={calendar ? open : undefined} value={value} onClick={(event) => { if (calendar && !event.currentTarget.matches(":disabled")) setOpen(true); }} onBlur={() => setTouched(true)} onChange={(event) => {
      const input = event.currentTarget;
      const before = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/\D/g, "").length;
      const formatted = formatDateInput(input.value);
      onChange(formatted);
      if (open) setOpen(false);
      const caret = before === 0 ? 0 : Math.min(formatted.length, [...formatted].findIndex((_, index) => formatted.slice(0, index + 1).replace(/\D/g, "").length === before) + 1);
      queueMicrotask(() => input.setSelectionRange(caret, caret));
    }} onKeyDown={(event) => {
      const input = event.currentTarget;
      const cursor = input.selectionStart ?? 0;
      if (event.key === "Backspace" && cursor > 0 && input.selectionEnd === cursor && value[cursor - 1] === "/") {
        event.preventDefault();
        const formatted = formatDateInput(value.slice(0, cursor - 2) + value.slice(cursor));
        onChange(formatted);
        queueMicrotask(() => input.setSelectionRange(Math.max(0, cursor - 2), Math.max(0, cursor - 2)));
      }
    }} />
    {invalid && <span id={messageId} className="field-error">{tooEarly ? `${label} debe ser posterior a la fecha de salida.` : "Indica una fecha real en formato DD/MM/AAAA."}</span>}
    {calendar && open && <CalendarPopover label={label} value={value} minIsoDate={minIsoDate} close={() => { setOpen(false); inputRef.current?.focus(); }} select={(iso) => { onChange(fromIsoDate(iso)); setTouched(true); setOpen(false); onCalendarSelect?.(iso); }} />}
  </div>;
}
