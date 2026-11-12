import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";
import { CouponManager } from "@/components/admin/coupon-manager";

export const metadata: Metadata = { title: "Coupons" };

export default async function CouponsPage() {
  const supabase = await createClient();
  const { data: coupons } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
  return (
    <>
      <PageTitle>Coupons</PageTitle>
      <CouponManager coupons={coupons ?? []} />
    </>
  );
}
