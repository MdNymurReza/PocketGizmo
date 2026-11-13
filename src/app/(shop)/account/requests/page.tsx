import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PenTool, Plus } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import { MyCustomRequests } from "@/components/shop/my-custom-requests";

export const metadata: Metadata = { title: "Custom requests" };

export default async function AccountRequestsPage() {
  const { supabase, user } = await getSessionProfile();
  if (!user) redirect("/login?next=/account/requests");
  const { data: requests } = await supabase
    .from("custom_requests")
    .select("id, description, status, quoted_price, admin_note, quantity, material, color, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Custom requests</h1>
          <p className="mt-1 text-sm text-ink-soft">Your custom print requests and our quotes.</p>
        </div>
        <ButtonLink href="/custom-order" size="sm">
          <Plus className="size-4" /> New request
        </ButtonLink>
      </div>

      <div className="mt-6">
        {requests?.length ? (
          <MyCustomRequests requests={requests} />
        ) : (
          <Card className="p-0">
            <EmptyState
              icon={PenTool}
              title="No custom requests yet"
              text="Have a design in mind? Upload a file or describe it, and we'll send you a quote."
              action={<ButtonLink href="/custom-order">Request a custom print</ButtonLink>}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
