import type { Metadata } from "next";
import { Playfair_Display, Lato } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { VoiceflowWidget } from "@/components/chat/voiceflow-widget";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
});
const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "My Corner",
  description: "Welcome to my personal website",
  generator: "v0.app",
  icons: {
    icon: {
      url: "/favicon-32.png",
      type: "image/png",
      sizes: "32x32",
    },
    apple: {
      url: "/apple-icon.png",
      type: "image/png",
      sizes: "180x180",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${playfair.variable} ${lato.variable} font-sans antialiased`}
      >
        {children}
        <Analytics />
        <VoiceflowWidget />
      </body>
    </html>
  );
}
