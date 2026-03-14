import "./globals.css";
import { SessionProvider } from "../providers/sessionProvider";

export const metadata = {
  title: "Clinic GS",
  description: "Clinic growth and operations system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
