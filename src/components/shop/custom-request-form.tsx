"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Check, CircleCheck, FileBox, Info, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { submitCustomRequest } from "@/app/(shop)/custom-order/actions";
import { CUSTOM_FILE_EXT, CUSTOM_MAX_FILES, CUSTOM_MAX_MB, MATERIALS, filamentLabel, type Filament } from "@/lib/custom";
import { FilamentSwatch } from "@/components/filament-swatch";
import { Button, ButtonLink, Field, Input, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";

type UploadedFile = { path: string; name: string; size: number };

const fmtSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);

export function CustomRequestForm({
  signedIn,
  defaults,
  filaments,
  maxColors,
}: {
  signedIn: boolean;
  defaults: { name: string; phone: string; email: string };
  /** Filaments in stock right now, managed in Admin → Filaments. */
  filaments: Filament[];
  /** How many colors one order can use (one per printer). */
  maxColors: number;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const byMaterial = filaments.reduce<Record<string, Filament[]>>((acc, f) => {
    (acc[f.material] ??= []).push(f);
    return acc;
  }, {});
  const pickedFilaments = filaments.filter((f) => picked.includes(f.id));
  const atLimit = picked.length >= maxColors;
  const togglePick = (id: string) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= maxColors ? p : [...p, id]));
    setErrors((er) => ({ ...er, colors: "" }));
  };

  const [folder] = useState(() => crypto.randomUUID());
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [form, setForm] = useState({ ...defaults, description: "", color: "", material: MATERIALS[0] as string, quantity: "1" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [captcha, setCaptcha] = useState("");
  const captchaRef = useRef<TurnstileHandle>(null);
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: "" }));
  };

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    const supabase = createClient();
    const picked = Array.from(list).slice(0, CUSTOM_MAX_FILES - files.length);
    if (list.length > picked.length) toast.error(`You can attach up to ${CUSTOM_MAX_FILES} files`);
    setUploading((n) => n + picked.length);
    for (const file of picked) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!(CUSTOM_FILE_EXT as readonly string[]).includes(ext)) {
        toast.error(`${file.name}: file type not supported`);
      } else if (file.size > CUSTOM_MAX_MB * 1024 * 1024) {
        toast.error(`${file.name} is larger than ${CUSTOM_MAX_MB} MB`);
      } else {
        const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
        const path = `requests/${folder}/${Date.now()}-${safe}`;
        const { error } = await supabase.storage.from("custom-uploads").upload(path, file);
        if (error) toast.error(`${file.name}: upload failed`);
        else setFiles((f) => [...f, { path, name: file.name, size: file.size }]);
      }
      setUploading((n) => n - 1);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading) return void toast.error("Please wait for uploads to finish");
    start(async () => {
      // With a filament list, the material follows from the colors picked.
      const material = filaments.length
        ? [...new Set(pickedFilaments.map((f) => f.material))].join(", ") || MATERIALS[0]
        : form.material;
      const res = await submitCustomRequest({
        folder,
        ...form,
        material,
        colors: pickedFilaments.map(filamentLabel),
        files: files.map((f) => f.path),
        captcha,
      });
      if (res.error) {
        captchaRef.current?.reset();
        setCaptcha("");
        if (res.field) setErrors((er) => ({ ...er, [res.field!]: res.error! }));
        toast.error(res.error);
        return;
      }
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  if (done) {
    return (
      <div className="rounded-xl border border-line p-10 text-center">
        <CircleCheck className="mx-auto size-8 text-success" strokeWidth={1.75} />
        <h2 className="mt-4 text-2xl font-semibold">Request received</h2>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">
          Thanks, {form.name.split(" ")[0]}! We&apos;ll review your request and contact you at {form.phone} with a quote.
          {signedIn && " You can also see the quote in your account."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {signedIn && <ButtonLink href="/account/requests">View my requests</ButtonLink>}
          <ButtonLink href="/shop" variant="secondary">Browse the shop</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="grid h-fit gap-6">
        <Field label="What would you like printed?" error={errors.description} hint="Size, purpose, deadline, anything that helps us quote accurately">
          <Textarea rows={6} value={form.description} onChange={set("description")} placeholder="e.g. A wall mount for my router, about 15cm wide, needs to hold 500g…" />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium">Files (optional)</p>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              upload(e.dataTransfer.files);
            }}
            className={cn(
              "grid place-items-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
              dragging ? "border-accent bg-accent/5" : "border-line bg-surface",
            )}
          >
            <Upload className="size-6 text-ink-soft" strokeWidth={1.5} />
            <p className="mt-3 text-sm">
              Drag files here or{" "}
              <button type="button" className="font-medium text-accent hover:underline" onClick={() => inputRef.current?.click()}>
                browse
              </button>
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              STL, 3MF, OBJ, STEP, images or PDF · up to {CUSTOM_MAX_FILES} files, {CUSTOM_MAX_MB} MB each
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              accept={CUSTOM_FILE_EXT.map((e) => `.${e}`).join(",")}
              onChange={(e) => upload(e.target.files)}
            />
          </div>
          {(files.length > 0 || uploading > 0) && (
            <ul className="mt-3 grid gap-2">
              {files.map((f) => (
                <li key={f.path} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                  <FileBox className="size-4 shrink-0 text-ink-soft" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-ink-soft">{fmtSize(f.size)}</span>
                  <button type="button" onClick={() => setFiles((x) => x.filter((y) => y.path !== f.path))} className="text-ink-soft hover:text-ink" aria-label={`Remove ${f.name}`}>
                    <X className="size-4" />
                  </button>
                </li>
              ))}
              {uploading > 0 && (
                <li className="flex items-center gap-2 px-3 py-2 text-sm text-ink-soft">
                  <Loader2 className="size-4 animate-spin" /> Uploading {uploading} file{uploading > 1 ? "s" : ""}…
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Colors: limited by the number of printers, chosen from the filaments in stock */}
        <div className="rounded-xl border border-line p-5">
          <p className="flex gap-2.5 rounded-lg bg-accent/5 px-3 py-2.5 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-accent" />
            <span>
              <span className="font-medium">
                Up to {maxColors} color{maxColors === 1 ? "" : "s"} per order.
              </span>{" "}
              <span className="text-ink-soft">
                We print on {maxColors} printer{maxColors === 1 ? "" : "s"}, so one order can&apos;t use more than {maxColors}{" "}
                color{maxColors === 1 ? "" : "s"} at a time.
              </span>
            </span>
          </p>

          {filaments.length > 0 ? (
            <fieldset className="mt-5">
              <legend className="flex w-full flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">Filaments available now</span>
                <span className={cn("tabular-nums", atLimit ? "font-medium text-ink" : "text-ink-soft")} aria-live="polite">
                  {picked.length} of {maxColors} selected
                </span>
              </legend>
              <div className="mt-3 grid gap-4">
                {Object.entries(byMaterial).map(([material, list]) => (
                  <div key={material}>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">{material}</p>
                    <div className="flex flex-wrap gap-2">
                      {list.map((f) => {
                        const on = picked.includes(f.id);
                        return (
                          <button
                            key={f.id}
                            type="button"
                            aria-pressed={on}
                            disabled={!on && atLimit}
                            onClick={() => togglePick(f.id)}
                            className={cn(
                              "inline-flex h-9 items-center gap-2 rounded-full border bg-white pr-3.5 pl-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                              on ? "border-ink font-medium ring-1 ring-ink" : "border-line hover:border-ink/40",
                            )}
                          >
                            <FilamentSwatch hex={f.hex} />
                            {f.color}
                            {on && <Check className="size-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {errors.colors ? (
                <p className="mt-3 text-sm text-danger" role="alert">
                  {errors.colors}
                </p>
              ) : (
                <p className="mt-3 text-xs text-ink-soft">
                  {atLimit
                    ? `That's the maximum. Remove one to pick a different color.`
                    : "Not sure, or need a color that isn't listed? Leave this empty and tell us in your description."}
                </p>
              )}
            </fieldset>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Material">
                <Select value={form.material} onChange={set("material")}>
                  {MATERIALS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Color preference" error={errors.color} hint={`Up to ${maxColors} colors`}>
                <Input value={form.color} onChange={set("color")} placeholder="e.g. Matte black, white" />
              </Field>
            </div>
          )}
        </div>

        <Field label="Quantity" error={errors.quantity} className="max-w-40">
          <Input type="number" min={1} value={form.quantity} onChange={set("quantity")} />
        </Field>
      </div>

      <aside className="h-fit rounded-xl bg-surface p-6 lg:sticky lg:top-24">
        <h2 className="font-semibold">Your contact details</h2>
        <p className="mt-1 text-sm text-ink-soft">We&apos;ll use these to send your quote.</p>
        <div className="mt-5 grid gap-4">
          <Field label="Full name" error={errors.name}>
            <Input value={form.name} onChange={set("name")} autoComplete="name" />
          </Field>
          <Field label="Mobile number" error={errors.phone}>
            <Input value={form.phone} onChange={set("phone")} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" autoComplete="tel" />
          </Field>
          <Field label="Email (optional)" error={errors.email}>
            <Input value={form.email} onChange={set("email")} type="email" autoComplete="email" />
          </Field>
        </div>
        <Turnstile ref={captchaRef} onToken={setCaptcha} className="mt-6" />
        <Button type="submit" size="lg" className="mt-6 w-full" disabled={pending || uploading > 0}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Sending…" : "Request a quote"}
        </Button>
        {!signedIn && (
          <p className="mt-3 text-center text-xs text-ink-soft">
            <Link href="/login?next=/custom-order" className="font-medium text-ink underline underline-offset-4">Log in</Link> to track your quote in your account.
          </p>
        )}
      </aside>
    </form>
  );
}
