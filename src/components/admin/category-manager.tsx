"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCategory, saveCategory } from "@/app/admin/actions";
import { Button, Card, Field, Input } from "@/components/ui";

type Category = { id: string; name: string; slug: string; sort_order: number; productCount: number };
type Draft = { id?: string; name: string; slug: string; sort_order: number };

const empty: Draft = { name: "", slug: "", sort_order: 0 };

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [draft, setDraft] = useState<Draft>(empty);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveCategory(draft);
      if (res.error) return void toast.error(res.error);
      toast.success(draft.id ? "Category updated" : "Category added");
      setDraft(empty);
    });
  };

  const remove = (c: Category) => {
    const msg = c.productCount
      ? `Delete "${c.name}"? Its ${c.productCount} product(s) will become uncategorized.`
      : `Delete "${c.name}"?`;
    if (!confirm(msg)) return;
    start(async () => {
      const res = await deleteCategory(c.id);
      if (res.error) toast.error(res.error);
      else toast.success("Category deleted");
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="p-0 overflow-hidden">
        {categories.length === 0 ? (
          <p className="p-6 text-ink-soft">No categories yet. Add your first one.</p>
        ) : (
          <ul className="divide-y divide-line">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-ink-soft">
                    /{c.slug} · {c.productCount} product{c.productCount === 1 ? "" : "s"} · order {c.sort_order}
                  </p>
                </div>
                <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => setDraft(c)}>
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} onClick={() => remove(c)} disabled={pending}>
                  <Trash2 className="size-4 text-danger" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="h-fit">
        <h2 className="mb-4 text-base font-semibold">{draft.id ? "Edit category" : "New category"}</h2>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Name">
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          </Field>
          <Field label="URL slug" hint="Leave blank to generate from the name">
            <Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
          </Field>
          <Field label="Sort order" hint="Lower numbers show first">
            <Input
              type="number"
              value={draft.sort_order}
              onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {draft.id ? "Save" : (<><Plus className="size-4" /> Add</>)}
            </Button>
            {draft.id && (
              <Button type="button" variant="secondary" onClick={() => setDraft(empty)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
