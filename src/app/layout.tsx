import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deepen Paper Graph",
  description: "Incremental paper graph memory system"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
