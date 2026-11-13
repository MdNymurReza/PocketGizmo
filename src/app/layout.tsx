import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { MotionProvider } from "@/components/motion";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "PocketGizmo: 3D-Printed Accessories", template: "%s · PocketGizmo" },
  description: "Precision 3D-printed accessories, made to order in Bangladesh. Pay with bKash, Nagad, Rocket or cash on delivery.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
        <MotionProvider>{children}</MotionProvider>
        <Toaster position="bottom-right" closeButton toastOptions={{ className: "font-sans" }} />
      </body>
    </html>
  );
}
