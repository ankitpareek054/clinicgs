import "./globals.css";
import { SessionProvider } from "../providers/sessionProvider";
import { ThemeProvider } from "../providers/themeProvider";

export const metadata = {
  title: "Clinic GS",
  description: "Clinic growth and operations system",
};

const themeScript = `
(() => {
  try {
    const STORAGE_KEY = "clinicgs-theme";
    const savedTheme = localStorage.getItem(STORAGE_KEY) || "system";
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const resolvedTheme = savedTheme === "system" ? systemTheme : savedTheme;
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  } catch (error) {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.colorScheme = "dark";
  }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>

      <body>
        <ThemeProvider>
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
