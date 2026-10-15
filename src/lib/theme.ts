export type ThemePreference = "system" | "light" | "dark";
export const themeStorageKey = "ordo-theme";

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function resolvedTheme(preference: ThemePreference, systemDark: boolean): "light" | "dark" {
  return preference === "system" ? systemDark ? "dark" : "light" : preference;
}
