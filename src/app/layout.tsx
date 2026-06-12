import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Subtext — subtitles for your videos",
  description:
    "Upload a video, get an editable AI transcript, and export subtitles or burn styled captions onto the video.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
