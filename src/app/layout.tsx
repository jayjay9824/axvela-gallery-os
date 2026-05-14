import type { Metadata } from "next";
import "./globals.css";
import MobileBlockNotice from "@/components/layout/MobileBlockNotice";

export const metadata: Metadata = {
  title: "AXVELA OS",
  description:
    "Artwork-Centric Operating System for Galleries. AI for Cultural Intelligence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
        <MobileBlockNotice />
      </body>
    </html>
  );
}