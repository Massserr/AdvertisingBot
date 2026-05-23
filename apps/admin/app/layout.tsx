import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "AdBot Admin",
  description: "Advertising marketplace admin panel"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
