"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { onboardingSchema, type OnboardingFormInput, type OnboardingInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { completeOnboarding } from "@/server/actions/auth";

type Name = keyof OnboardingFormInput;
const STEPS: { id: string; label: string; title: string; sub: string; fields: Name[] }[] = [
  { id: "restaurant", label: "Restaurant", title: "Welcome to Kitchi", sub: "Let's get your restaurant ready. This takes about two minutes.", fields: ["ownerName", "email", "restaurantName"] },
  { id: "type", label: "Type", title: "What kind of place is it?", sub: "We'll tune defaults for you. You can change this later.", fields: ["type"] },
  { id: "outlet", label: "First outlet", title: "Add your first outlet", sub: "Most restaurants start with one. Add more whenever you grow.", fields: ["outletName", "city", "address", "phone"] },
  { id: "business", label: "Business", title: "Business information", sub: "Shown on receipts and invoices.", fields: ["legalName"] },
  { id: "gst", label: "GST", title: "GST configuration", sub: "Kitchi adds GST on top of your item prices.", fields: ["gstEnabled", "gstin", "defaultTaxRate"] },
  { id: "menu", label: "Menu", title: "Add your menu", sub: "Start with a sample café menu, or build your own from scratch.", fields: ["menuMode"] },
  { id: "tables", label: "Tables", title: "Configure tables", sub: "How many tables do you seat? Takeaway-only? Choose none.", fields: ["tableCount"] },
  { id: "finish", label: "Finish", title: "You're all set", sub: "Here's what we'll create.", fields: [] },
];

const TYPES: { v: OnboardingInput["type"]; label: string; d: string }[] = [
  { v: "CAFE", label: "Café", d: "Coffee, snacks, light meals" }, { v: "RESTAURANT", label: "Restaurant", d: "Full dine-in service" }, { v: "QSR", label: "QSR", d: "Quick service, high volume" },
  { v: "CLOUD_KITCHEN", label: "Cloud kitchen", d: "Delivery only" }, { v: "BAKERY", label: "Bakery", d: "Counter and takeaway" }, { v: "BAR", label: "Bar", d: "Drinks and bites" }, { v: "OTHER", label: "Other", d: "Something different" },
];

export function Wizard() {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const form = useForm<OnboardingFormInput, unknown, OnboardingInput>({
    resolver: zodResolver(onboardingSchema), mode: "onTouched",
    defaultValues: { ownerName: "", email: "", restaurantName: "", type: "CAFE", outletName: "", city: "Pune", address: "", phone: "", legalName: "", gstEnabled: true, gstin: "", defaultTaxRate: 5, menuMode: "STARTER", tableCount: 8 },
  });
  const { register, control, trigger, watch, getValues, handleSubmit, formState: { errors } } = form;
  const s = STEPS[step]!;
  const last = step === STEPS.length - 1;

  const next = async () => {
    if (s.fields.length && !(await trigger(s.fields))) return;
    if (s.id === "gst" && getValues("gstEnabled") && getValues("gstin") && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(String(getValues("gstin")).toUpperCase())) {
      form.setError("gstin", { message: "That doesn't look like a valid GSTIN" });
      return;
    }
    if (step === 0 && !getValues("outletName")) form.setValue("outletName", getValues("restaurantName") ? "Main outlet" : "");
    setStep((x) => x + 1);
  };

  const finish = handleSubmit(async (v) => {
    setBusy(true);
    const r = await completeOnboarding(v);
    if (!r.ok) { setBusy(false); return toast.error(r.error); }
    toast.success("Welcome to Kitchi", { description: "Your workspace is ready." });
    router.push("/overview");
    router.refresh();
  });

  const v = watch();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[320px_1fr]">
      <aside className="hidden flex-col border-r border-line bg-muted/50 p-8 lg:flex">
        <Wordmark />
        <ol className="mt-12 space-y-1" aria-label="Setup progress">
          {STEPS.map((x, i) => (
            <li key={x.id} aria-current={i === step ? "step" : undefined} className={cn("flex items-center gap-3 rounded-md px-2 py-1.5 text-[13px]", i === step ? "font-medium text-fg" : i < step ? "text-fg-muted" : "text-fg-subtle")}>
              <span className={cn("grid size-5 place-items-center rounded-full border text-[10.5px] font-semibold", i < step ? "border-brand bg-brand text-white" : i === step ? "border-fg text-fg" : "border-line-strong")}>{i < step ? <Check className="size-3" strokeWidth={3} /> : i + 1}</span>
              {x.label}
            </li>
          ))}
        </ol>
        <p className="mt-auto text-xs text-fg-subtle">Already set up? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link></p>
      </aside>

      <main id="main" className="flex flex-col">
        <div className="lg:hidden">
          <div className="flex items-center justify-between px-5 pt-5"><Wordmark /><span className="tnum text-xs text-fg-muted">Step {step + 1} of {STEPS.length}</span></div>
        </div>
        <div className="h-1 w-full bg-muted lg:hidden" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Setup progress"><div className="h-full bg-brand transition-[width] duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>

        <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-5 py-10">
          <p className="tnum mb-2 hidden text-xs font-medium text-fg-subtle lg:block">Step {step + 1} of {STEPS.length}</p>
          <h1 className="text-[24px] font-semibold tracking-[-0.03em]">{s.title}</h1>
          <p className="mt-1.5 text-[14px] text-fg-muted">{s.sub}</p>

          <form className="mt-8" onSubmit={(e) => { e.preventDefault(); if (last) void finish(); else void next(); }} noValidate>
            <div key={s.id} className="space-y-4 animate-[k-fade-in_200ms_ease-out]">
              {s.id === "restaurant" && (<>
                <Field label="Your name" htmlFor="ow" error={errors.ownerName?.message}><Input id="ow" autoFocus autoComplete="name" aria-invalid={!!errors.ownerName} {...register("ownerName")} placeholder="Pawan Deshmukh" /></Field>
                <Field label="Work email" htmlFor="em" error={errors.email?.message}><Input id="em" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} placeholder="you@restaurant.com" /></Field>
                <Field label="Restaurant name" htmlFor="rn" error={errors.restaurantName?.message}><Input id="rn" aria-invalid={!!errors.restaurantName} {...register("restaurantName")} placeholder="Bombay Brew Café" /></Field>
              </>)}
              {s.id === "type" && (
                <Controller control={control} name="type" render={({ field }) => (
                  <div role="radiogroup" aria-label="Restaurant type" className="grid grid-cols-2 gap-2.5">
                    {TYPES.map((t) => (
                      <button key={t.v} type="button" role="radio" aria-checked={field.value === t.v} onClick={() => field.onChange(t.v)} className={cn("rounded-xl border p-3.5 text-left transition-colors", field.value === t.v ? "border-brand bg-brand-soft/50 ring-1 ring-brand" : "border-line-strong hover:bg-muted", t.v === "OTHER" && "col-span-2 sm:col-span-1")}>
                        <span className="block text-[13.5px] font-medium">{t.label}</span><span className="mt-0.5 block text-xs text-fg-muted">{t.d}</span>
                      </button>
                    ))}
                  </div>
                )} />
              )}
              {s.id === "outlet" && (<>
                <Field label="Outlet name" htmlFor="on" error={errors.outletName?.message}><Input id="on" autoFocus aria-invalid={!!errors.outletName} {...register("outletName")} placeholder="Koregaon Park" /></Field>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="City" htmlFor="ci" error={errors.city?.message}><Input id="ci" {...register("city")} /></Field><Field label="Phone" htmlFor="ph" error={errors.phone?.message}><Input id="ph" inputMode="tel" {...register("phone")} placeholder="+91 98XXX XXXXX" /></Field></div>
                <Field label="Address" htmlFor="ad" error={errors.address?.message}><Input id="ad" {...register("address")} placeholder="Street, area, pincode" /></Field>
              </>)}
              {s.id === "business" && (<>
                <Field label="Legal business name" htmlFor="lg" hint="Optional. Shown on invoices if different from your restaurant name."><Input id="lg" autoFocus {...register("legalName")} placeholder={v.restaurantName ? `${v.restaurantName} LLP` : "Company name"} /></Field>
                <p className="rounded-lg bg-muted px-3.5 py-3 text-[13px] text-fg-muted">FSSAI licence, logo and receipt branding can be added later in Settings.</p>
              </>)}
              {s.id === "gst" && (<>
                <Controller control={control} name="gstEnabled" render={({ field }) => (
                  <label className="flex items-center justify-between rounded-xl border border-line-strong px-4 py-3.5"><span><span className="block text-[13.5px] font-medium">I&apos;m registered for GST</span><span className="block text-xs text-fg-muted">Turn off if you don&apos;t charge GST.</span></span><Switch checked={!!field.value} onCheckedChange={field.onChange} aria-label="Registered for GST" /></label>
                )} />
                {v.gstEnabled && (<>
                  <Field label="GSTIN" htmlFor="gi" error={errors.gstin?.message} hint="Optional now — add it later in Settings."><Input id="gi" maxLength={15} className="uppercase" {...register("gstin")} placeholder="27AAKFK1234F1Z5" /></Field>
                  <Field label="Default GST rate" htmlFor="gr"><select id="gr" {...register("defaultTaxRate", { valueAsNumber: true })} className="h-9 w-full rounded-md border border-line-strong bg-surface px-2.5 text-[13px]">{[0, 5, 12, 18].map((r) => <option key={r} value={r}>{r}%{r === 5 ? " — typical for restaurants" : ""}</option>)}</select></Field>
                </>)}
              </>)}
              {s.id === "menu" && (
                <Controller control={control} name="menuMode" render={({ field }) => (
                  <div role="radiogroup" aria-label="Menu" className="space-y-2.5">
                    {[{ v: "STARTER", t: "Use a sample menu", d: "30 items across Starters, Main Course, Pizza, Drinks and Desserts with sizes and add-ons. Edit or delete anything." }, { v: "EMPTY", t: "Start from scratch", d: "Add your own categories and items from the Menu page." }].map((o) => (
                      <button key={o.v} type="button" role="radio" aria-checked={field.value === o.v} onClick={() => field.onChange(o.v)} className={cn("w-full rounded-xl border p-4 text-left transition-colors", field.value === o.v ? "border-brand bg-brand-soft/50 ring-1 ring-brand" : "border-line-strong hover:bg-muted")}><span className="block text-[13.5px] font-medium">{o.t}</span><span className="mt-0.5 block text-[13px] text-fg-muted">{o.d}</span></button>
                    ))}
                  </div>
                )} />
              )}
              {s.id === "tables" && (
                <Controller control={control} name="tableCount" render={({ field }) => {
                  const n = Number(field.value) || 0;
                  return (
                    <div>
                      <div className="flex items-center justify-center gap-5 rounded-xl border border-line-strong py-6">
                        <Button size="icon-lg" aria-label="Fewer tables" onClick={() => field.onChange(Math.max(0, n - 1))}><Minus className="size-4" /></Button>
                        <div className="w-24 text-center"><p className="tnum text-[40px] font-semibold leading-none tracking-tight">{n}</p><p className="mt-1 text-xs text-fg-muted">tables</p></div>
                        <Button size="icon-lg" aria-label="More tables" onClick={() => field.onChange(Math.min(80, n + 1))}><Plus className="size-4" /></Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">{[0, 6, 8, 12, 20].map((c) => <Button key={c} size="sm" variant={n === c ? "soft" : "secondary"} onClick={() => field.onChange(c)}>{c === 0 ? "None" : c}</Button>)}</div>
                    </div>
                  );
                }} />
              )}
              {s.id === "finish" && (
                <dl className="divide-y divide-line rounded-xl border border-line text-[13px]">
                  {[["Restaurant", v.restaurantName], ["Type", TYPES.find((t) => t.v === v.type)?.label], ["Outlet", `${v.outletName}, ${v.city}`], ["GST", v.gstEnabled ? `On · ${v.defaultTaxRate}%${v.gstin ? ` · ${String(v.gstin).toUpperCase()}` : ""}` : "Off"], ["Menu", v.menuMode === "STARTER" ? "Sample menu (30 items)" : "Empty — add items yourself"], ["Tables", Number(v.tableCount) ? `${v.tableCount} tables` : "None (takeaway only)"]].map(([k, val]) => (
                    <div key={k} className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-fg-muted">{k}</dt><dd className="text-right font-medium">{val}</dd></div>
                  ))}
                </dl>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep((x) => Math.max(0, x - 1))} className={step === 0 ? "invisible" : ""}><ArrowLeft className="size-3.5" /> Back</Button>
              <Button type="submit" variant="primary" size="lg" loading={busy}>{last ? "Open my workspace" : "Continue"}{!last && <ArrowRight className="size-3.5" />}</Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
