import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeneoTools",
  description: "Инструменты для генеалогов",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
