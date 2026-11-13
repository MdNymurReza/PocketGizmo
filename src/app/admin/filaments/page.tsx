import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";
import { FilamentManager } from "@/components/admin/filament-manager";

export const metadata: Metadata = { title: "Filaments" };

export default async function FilamentsPage() {
  const supabase = await createClient();
  const [{ data: filaments }, { data: settings }] = await Promise.all([
    supabase.from("filaments").select("id, material, color, hex, in_stock").order("material").order("color"),
    supabase.from("settings").select("max_print_colors").eq("id", 1).single(),
  ]);

  return (
    <>
      <PageTitle
        action={
          <Link href="/custom-order" target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink">
            See the customer view <ArrowUpRight className="size-4" />
          </Link>
        }
      >
        Filaments
      </PageTitle>
      <FilamentManager filaments={filaments ?? []} maxColors={settings?.max_print_colors ?? 4} />
    </>
  );
}
