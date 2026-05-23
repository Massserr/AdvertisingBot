import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "AdBot Mini App",
  description: "Telegram advertising marketplace"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
