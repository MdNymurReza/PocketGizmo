import type { Enums } from "@/lib/database.types";

export const CUSTOM_FILE_EXT = ["stl", "3mf", "obj", "step", "stp", "png", "jpg", "jpeg", "webp", "pdf"] as const;
export const CUSTOM_MAX_FILES = 5;
export const CUSTOM_MAX_MB = 50;
export const MATERIALS = ["Not sure, recommend one", "PLA", "PETG", "TPU (flexible)", "ABS"] as const;

export const CUSTOM_STATUS_LABEL: Record<Enums<"custom_request_status">, string> = {
  new: "Under review",
  quoted: "Quote ready",
  accepted: "Accepted",
  rejected: "Declined",
  done: "Completed",
};

export const CUSTOM_STATUS_COLOR = {
  new: "warning",
  quoted: "accent",
  accepted: "success",
  rejected: "neutral",
  done: "success",
} as const;

/** Display name for a stored file path like requests/<uuid>/<name>. */
export const fileName = (path: string) => path.split("/").pop() ?? path;
