"use client";
import { type ComponentProps, type FormEvent } from "react";
import { formatCustomerText } from "@/lib/customer-format";

type Props = Omit<ComponentProps<"input">, "onChange"> & { onChange?: ComponentProps<"input">["onChange"]; formatKind?: "person" | "place" };

export function CustomerTextInput({ onChange, onCompositionEnd, formatKind = "person", ...props }: Props) {
  function format(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const original = input.value;
    const updated = formatCustomerText(original, formatKind);
    if (original !== updated) {
      input.value = updated;
      input.setSelectionRange(formatCustomerText(original.slice(0, start), formatKind).length, formatCustomerText(original.slice(0, end), formatKind).length);
    }
  }
  return <input {...props} onChange={(event) => {
    if (!(event.nativeEvent as InputEvent).isComposing) format(event);
    onChange?.(event);
  }} onCompositionEnd={(event) => { format(event); onCompositionEnd?.(event); }} />;
}
