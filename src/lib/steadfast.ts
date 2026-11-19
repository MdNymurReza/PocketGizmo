import "server-only";

/**
 * Steadfast Courier merchant API (portal.packzy.com). Needs STEADFAST_API_KEY and STEADFAST_SECRET_KEY,
 * from the Steadfast merchant panel → API.
 */
const BASE = (process.env.STEADFAST_BASE_URL ?? "https://portal.packzy.com/api/v1").replace(/\/$/, "");

export const steadfastConfigured = () => Boolean(process.env.STEADFAST_API_KEY && process.env.STEADFAST_SECRET_KEY);

/** Public tracking page for a Steadfast tracking code. */
export const steadfastTrackingUrl = (code: string) => `https://steadfast.com.bd/t/${encodeURIComponent(code)}`;

async function call<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "Api-Key": process.env.STEADFAST_API_KEY ?? "",
      "Secret-Key": process.env.STEADFAST_SECRET_KEY ?? "",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as (T & { status?: number; message?: string; errors?: Record<string, string[]> }) | null;
  if (!res.ok || !data || (data.status !== undefined && data.status !== 200)) {
    const detail = data?.errors ? Object.values(data.errors).flat().join(", ") : data?.message;
    if (res.status === 401 || res.status === 403) throw new Error("Steadfast rejected the API key or secret");
    throw new Error(detail ? `Steadfast: ${detail}` : `Steadfast error (${res.status})`);
  }
  return data;
}

export type SteadfastConsignment = { consignment_id: number | string; tracking_code: string; status: string };

export async function createConsignment(input: {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
  item_description?: string;
}) {
  const data = await call<{ consignment?: SteadfastConsignment }>("/create_order", { method: "POST", body: input });
  if (!data.consignment?.tracking_code) throw new Error("Steadfast did not return a tracking code");
  return data.consignment;
}

export const STEADFAST_STATUS_LABEL: Record<string, string> = {
  in_review: "Under review at Steadfast",
  pending: "On the way",
  hold: "On hold",
  delivered_approval_pending: "Delivered, waiting for Steadfast approval",
  partial_delivered_approval_pending: "Partly delivered, waiting for approval",
  cancelled_approval_pending: "Cancelled, waiting for approval",
  unknown_approval_pending: "Unknown, contact Steadfast",
  delivered: "Delivered",
  partial_delivered: "Partly delivered",
  cancelled: "Cancelled by courier",
  unknown: "Unknown",
};

export async function consignmentStatus(consignmentId: string) {
  const data = await call<{ delivery_status?: string }>(`/status_by_cid/${encodeURIComponent(consignmentId)}`);
  return data.delivery_status ?? "unknown";
}
