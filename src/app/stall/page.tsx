import type { Metadata, Viewport } from "next";
import { StallApp } from "@/components/stall/stall-app";

export const metadata: Metadata = { title: "Stall", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#7c3aed" };

/**
 * The offline stall app. This page has no data of its own, so the device can keep a copy and open it without internet.
 * Orders are saved on the device and uploaded by "Sync", which needs the admin to be logged in.
 */
export default function StallAppPage() {
  return <StallApp />;
}
