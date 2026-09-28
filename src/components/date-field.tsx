"use client";
import { useId, useState } from "react";
import { formatDateInput, toIsoDate } from "@/lib/local-date";

type Props = { id: string; label: string; value: string; onChange: (display: string) => void };

export function DateField({ id, label, value, onChange }: Props) {
  const [touched, setTouched] = useState(false);
  const messageId = useId();
  const invalid = touched && !!value && !toIsoDate(value);
  return <div className="field"><label htmlFor={id}>{label}</label>
    <input id={id} type="text" inputMode="numeric" autoComplete="off" placeholder="DD/MM/AAAA" maxLength={10} aria-invalid={invalid || undefined} aria-describedby={invalid ? messageId : undefined} value={value} onBlur={() => setTouched(true)} onChange={(event) => {
      const input = event.currentTarget;
      const before = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/\D/g, "").length;
      const formatted = formatDateInput(input.value);
      onChange(formatted);
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
    {invalid && <span id={messageId} className="field-error">Indica una fecha real en formato DD/MM/AAAA.</span>}
  </div>;
}
