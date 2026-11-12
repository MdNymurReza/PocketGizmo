"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { CAPTCHA_ERROR, verifyCaptcha } from "@/lib/turnstile";
import { esc, notifyAdmin, siteUrl } from "@/lib/notify";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { BD_PHONE_RE, normalizePhone } from "@/lib/bd";
import { CUSTOM_MAX_FILES } from "@/lib/custom";

const schema = z.object({
  folder: z.uuid(),
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z.string().trim().regex(BD_PHONE_RE, "Enter a valid mobile number (01XXXXXXXXX)"),
  email: z.union([z.email("Enter a valid email"), z.literal("")]).optional(),
  description: z.string().trim().min(10, "Tell us a bit more about what you need (at least 10 characters)").max(3000),
  color: z.string().trim().max(60).optional(),
  material: z.string().trim().max(60).optional(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(1000),
  files: z.array(z.string()).max(CUSTOM_MAX_FILES),
  captcha: z.string().max(4096).optional(),
});

export type CustomInput = z.input<typeof schema>;

export async function submitCustomRequest(input: CustomInput): Promise<{ error?: string; field?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: issue.path.join(".") };
  }
  const r = parsed.data;
  // Only accept files uploaded into this request's own folder.
  if (r.files.some((f) => !f.startsWith(`requests/${r.folder}/`) || f.includes(".."))) {
    return { error: "Invalid file upload, please try again" };
  }
  if (!(await verifyCaptcha(r.captcha))) return { error: CAPTCHA_ERROR, field: "captcha" };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("custom_requests").insert({
    user_id: auth.user?.id ?? null,
    name: r.name,
    phone: normalizePhone(r.phone),
    email: r.email || null,
    description: r.description,
    color: r.color || null,
    material: r.material || null,
    quantity: r.quantity,
    files: r.files,
  });
  if (error) return { error: "Couldn't send your request. Please try again." };
  revalidatePath("/admin/custom-requests");
  after(() =>
    notifyAdmin(
      [
        `✏️ <b>New custom print request</b>`,
        `${esc(r.name)} · ${esc(normalizePhone(r.phone))}`,
        `Qty ${r.quantity}${r.material ? ` · ${esc(r.material)}` : ""}${r.color ? ` · ${esc(r.color)}` : ""} · ${r.files.length} file(s)`,
        "",
        esc(r.description.length > 300 ? `${r.description.slice(0, 300)}…` : r.description),
        "",
        `<a href="${siteUrl("/admin/custom-requests")}">Open in admin</a>`,
      ].join("\n"),
    ),
  );
  return {};
}

export async function respondToQuote(id: string, accept: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_quote", { p_id: id, p_accept: accept });
  if (error) return { error: error.message };
  revalidatePath("/account");
  revalidatePath("/admin/custom-requests");
  return {};
}
