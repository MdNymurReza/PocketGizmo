"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { esc, notifyAdmin, siteUrl } from "@/lib/notify";

const schema = z.object({
  productId: z.uuid(),
  slug: z.string().min(1).max(200),
  rating: z.number().int().min(1, "Choose a rating from 1 to 5 stars").max(5),
  comment: z.string().trim().max(1500, "Please keep your review under 1,500 characters"),
  photos: z.array(z.url().max(500)).max(3, "You can add up to 3 photos").default([]),
});

export type ReviewInput = z.input<typeof schema>;

export async function submitReview(input: ReviewInput): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const r = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_review", { p_product: r.productId, p_rating: r.rating, p_comment: r.comment, p_photos: r.photos });
  if (error) {
    // Messages raised by submit_review are written for customers; hide anything else.
    const known = /log in|rating|too long|delivered|photo/i;
    return { error: known.test(error.message) ? error.message : "Couldn't save your review. Please try again." };
  }
  revalidatePath(`/product/${r.slug}`);
  revalidatePath("/admin/reviews");
  after(() =>
    notifyAdmin(
      [
        `⭐ <b>New review to approve</b> (${r.rating}/5)`,
        esc(r.comment.length > 300 ? `${r.comment.slice(0, 300)}…` : r.comment || "(no comment)"),
        ...(r.photos.length ? [`📷 ${r.photos.length} photo${r.photos.length === 1 ? "" : "s"}`] : []),
        "",
        `<a href="${siteUrl("/admin/reviews")}">Open in admin</a>`,
      ].join("\n"),
    ),
  );
  return {};
}

/** Save a product to the customer's list, or remove it if it is already there. */
export async function toggleWishlist(productId: string): Promise<{ error?: string; saved?: boolean; login?: boolean }> {
  if (!z.uuid().safeParse(productId).success) return { error: "Invalid product" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { login: true };
  const { data: removed, error: delError } = await supabase.from("wishlist_items").delete().eq("user_id", auth.user.id).eq("product_id", productId).select("product_id");
  if (delError) return { error: "Couldn't update your saved items. Please try again." };
  if (!removed.length) {
    const { error } = await supabase.from("wishlist_items").insert({ user_id: auth.user.id, product_id: productId });
    if (error) return { error: "Couldn't save this product. Please try again." };
  }
  revalidatePath("/account/wishlist");
  return { saved: !removed.length };
}

export async function deleteMyReview(productId: string, slug: string): Promise<{ error?: string }> {
  if (!z.uuid().safeParse(productId).success) return { error: "Invalid product" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please log in again" };
  const { error } = await supabase.from("reviews").delete().eq("product_id", productId).eq("user_id", auth.user.id);
  if (error) return { error: "Couldn't delete your review. Please try again." };
  revalidatePath(`/product/${slug}`);
  revalidatePath("/admin/reviews");
  return {};
}
