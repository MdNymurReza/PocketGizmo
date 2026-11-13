import type { Metadata } from "next";
import { FileUp, MessageSquareQuote, Printer } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import { CustomRequestForm } from "@/components/shop/custom-request-form";

export const metadata: Metadata = {
  title: "Custom 3D printing",
  description: "Upload your STL, 3MF or OBJ file, or describe your idea, and get a quote for custom 3D printing in Bangladesh.",
};

const STEPS = [
  { icon: FileUp, title: "Send your design", text: "Upload a 3D file or reference photos, or simply describe the idea." },
  { icon: MessageSquareQuote, title: "Get a quote", text: "We review it and send you a price by phone or in your account." },
  { icon: Printer, title: "We print & deliver", text: "Once you approve, we print it and deliver anywhere in Bangladesh." },
];

export default async function CustomOrderPage() {
  const { supabase, user, profile } = await getSessionProfile();
  const [{ data: filaments }, { data: settings }] = await Promise.all([
    supabase.from("filaments").select("id, material, color, hex, in_stock").eq("in_stock", true).order("material").order("color"),
    supabase.from("settings").select("max_print_colors").eq("id", 1).single(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-accent">Custom printing</p>
        <h1 className="mt-2 text-4xl font-semibold">Bring your idea to life</h1>
        <p className="mt-3 text-lg text-ink-soft">
          Replacement parts, prototypes, gifts or something entirely new. Tell us what you need and we&apos;ll quote it.
        </p>
      </div>

      <ol className="mt-10 grid gap-6 border-y border-line py-8 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface">
              <Icon className="size-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-sm font-medium">
                {i + 1}. {title}
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">{text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10">
        <CustomRequestForm
          signedIn={Boolean(user)}
          defaults={{ name: profile?.full_name ?? "", phone: profile?.phone ?? "", email: user?.email ?? "" }}
          filaments={filaments ?? []}
          maxColors={settings?.max_print_colors ?? 4}
        />
      </div>
    </div>
  );
}
