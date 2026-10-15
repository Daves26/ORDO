"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { isThemePreference, resolvedTheme, themeStorageKey, type ThemePreference } from "@/lib/theme";

function applyTheme(preference: ThemePreference) {
  const dark = resolvedTheme(preference, window.matchMedia("(prefers-color-scheme: dark)").matches) === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b1220" : "#f6f8fc");
}

export function ThemeSwitcher() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [open, setOpen] = useState(false);
  const current = useRef<ThemePreference>("system");
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selectedOption = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(themeStorageKey); } catch { /* Private browsing may disable storage. */ }
    const chosen = isThemePreference(stored) ? stored : "system";
    current.current = chosen;
    setPreference(chosen);
    applyTheme(chosen);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => { if (current.current === "system") applyTheme("system"); };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);
  useEffect(() => {
    if (!open) return;
    selectedOption.current?.focus();
    const closeOnOutside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [open]);
  function change(value: ThemePreference) {
    current.current = value;
    setPreference(value);
    try { localStorage.setItem(themeStorageKey, value); } catch { /* The selection still works this session. */ }
    applyTheme(value);
    setOpen(false);
    trigger.current?.focus();
  }
  const Icon = preference === "dark" ? Moon : preference === "light" ? Sun : Monitor;
  const options = [{ value: "system", label: "Sistema", Icon: Monitor }, { value: "light", label: "Claro", Icon: Sun }, { value: "dark", label: "Oscuro", Icon: Moon }] as const;
  const activeLabel = options.find(({ value }) => value === preference)!.label;
  return <div className="theme-control" ref={wrapper} onKeyDown={(event) => {
    if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" className="theme-trigger" aria-label={`Apariencia: ${activeLabel}`} title={`Apariencia: ${activeLabel}`} aria-expanded={open} aria-controls={open ? "theme-options" : undefined} onClick={() => setOpen((value) => !value)}><Icon size={19} aria-hidden="true" /></button>
    {open && <div id="theme-options" className="theme-popover" role="group" aria-label="Seleccionar apariencia">
      {options.map(({ value, label, Icon: OptionIcon }) => <button key={value} type="button" ref={preference === value ? selectedOption : undefined} className="theme-option" aria-pressed={preference === value} onClick={() => change(value)}><OptionIcon size={17} aria-hidden="true" /><span>{label}</span>{preference === value && <Check size={15} aria-hidden="true" />}</button>)}
    </div>}
  </div>;
}
