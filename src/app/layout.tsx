import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-800.css";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ordo · Agencia", description: "Expediente central de viajes" };
// Run before the browser paints to avoid a flash of the wrong color scheme.
const themeBootstrap = `(function(){var p;try{p=localStorage.getItem("ordo-theme")}catch(e){}var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";document.querySelector('meta[name="theme-color"]')?.setAttribute("content",d?"#0b1220":"#f6f8fc")})();`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es" suppressHydrationWarning><head><meta name="theme-color" content="#f6f8fc" /><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head><body><a href="#main-content" className="skip-link">Ir al contenido</a>{children}</body></html>;
}
