"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Segmented } from "@/components/ui/primitives";
import { Sheet, SheetBody, SheetContent, SheetFooter } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { formatMoney, toRupees } from "@/lib/money";
import { menuItemSchema, type MenuItemFormInput, type MenuItemInput } from "@/lib/schemas";
import { saveMenuItemAction } from "@/server/actions/ops";
import type { Category, MenuItem, ModifierGroup } from "@/types/domain";

const blank = (categoryId: string): MenuItemFormInput => ({ name: "", description: "", categoryId, price: 0, taxRate: 5, foodType: "VEG", sku: "", available: true, variants: [], modifierGroupIds: [] });

export function ItemFormSheet({ open, onOpenChange, item, categories, groups, defaultCategoryId }: { open: boolean; onOpenChange: (o: boolean) => void; item: MenuItem | null; categories: Category[]; groups: ModifierGroup[]; defaultCategoryId?: string }) {
  const router = useRouter();
  const form = useForm<MenuItemFormInput, unknown, MenuItemInput>({ resolver: zodResolver(menuItemSchema), defaultValues: blank(categories[0]?.id ?? "") });
  const { register, control, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = form;
  const variants = useFieldArray({ control, name: "variants" });

  React.useEffect(() => {
    if (!open) return;
    reset(item
      ? { name: item.name, description: item.description, categoryId: item.categoryId, price: toRupees(item.price), taxRate: item.taxRate, foodType: item.foodType, sku: item.sku, available: item.available, variants: item.variants.map((v) => ({ name: v.name, price: toRupees(v.price) })), modifierGroupIds: item.modifierGroupIds }
      : blank(defaultCategoryId ?? categories[0]?.id ?? ""));
  }, [open, item, reset, categories, defaultCategoryId]);

  const onSubmit = handleSubmit(async (values) => {
    const r = await saveMenuItemAction(item?.id ?? null, values);
    if (!r.ok) return toast.error(r.error);
    toast.success(item ? "Item updated" : "Item created", { description: values.name });
    onOpenChange(false);
    router.refresh();
  });

  const selected = watch("modifierGroupIds") ?? [];
  const hasVariants = (watch("variants") ?? []).length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={item ? "Edit item" : "New menu item"} description={item ? item.name : "Appears in POS as soon as it's saved."} className="max-w-[520px]">
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <SheetBody className="space-y-5 px-5 py-4">
            <Field label="Name" htmlFor="mi-name" error={errors.name?.message}><Input id="mi-name" autoFocus aria-invalid={!!errors.name} {...register("name")} placeholder="e.g. Chicken Biryani" /></Field>
            <Field label="Description" htmlFor="mi-desc" error={errors.description?.message}><Textarea id="mi-desc" {...register("description")} placeholder="Shown to staff in POS" className="min-h-[56px]" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category" htmlFor="mi-cat" error={errors.categoryId?.message}><Select id="mi-cat" {...register("categoryId")}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
              <Field label="SKU" htmlFor="mi-sku" hint="Optional — generated if blank"><Input id="mi-sku" {...register("sku")} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={hasVariants ? "Base price (₹)" : "Price (₹)"} htmlFor="mi-price" error={errors.price?.message} hint="Excludes GST"><Input id="mi-price" inputMode="decimal" type="number" step="1" min={0} aria-invalid={!!errors.price} {...register("price")} /></Field>
              <Field label="Tax (GST)" htmlFor="mi-tax"><Select id="mi-tax" {...register("taxRate", { valueAsNumber: true })}>{[0, 5, 12, 18, 28].map((t) => <option key={t} value={t}>{t}%</option>)}</Select></Field>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="mb-1 block text-xs font-medium text-fg-muted">Food type</span>
                <Controller control={control} name="foodType" render={({ field }) => <Segmented value={field.value} onChange={field.onChange} options={[{ value: "VEG", label: "Veg" }, { value: "NON_VEG", label: "Non-veg" }, { value: "EGG", label: "Egg" }]} />} />
              </div>
              <label className="flex items-center gap-2 text-[13px] font-medium"><Controller control={control} name="available" render={({ field }) => <Switch checked={!!field.value} onCheckedChange={field.onChange} aria-label="Available" />} /> Available</label>
            </div>

            <fieldset>
              <div className="mb-2 flex items-center justify-between">
                <legend className="text-xs font-medium text-fg-muted">Variants <span className="font-normal text-fg-subtle">· e.g. Regular, Large</span></legend>
                <Button size="xs" variant="ghost" onClick={() => variants.append({ name: variants.fields.length === 0 ? "Regular" : "", price: Number(watch("price")) || 0 })}><Plus className="size-3" /> Add</Button>
              </div>
              {variants.fields.length === 0 ? <p className="rounded-lg border border-dashed border-line-strong px-3 py-3 text-[13px] text-fg-muted">No variants. The base price is used.</p> : (
                <ul className="space-y-2">
                  {variants.fields.map((f, i) => (
                    <li key={f.id} className="flex items-start gap-2">
                      <div className="flex-1"><Input aria-label={`Variant ${i + 1} name`} placeholder="Name" aria-invalid={!!errors.variants?.[i]?.name} {...register(`variants.${i}.name`)} /></div>
                      <div className="relative w-28"><span className="pointer-events-none absolute left-2.5 top-2 text-fg-subtle">₹</span><Input aria-label={`Variant ${i + 1} price`} inputMode="decimal" type="number" min={0} className="pl-6" {...register(`variants.${i}.price`)} /></div>
                      <button type="button" onClick={() => variants.remove(i)} className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-muted hover:text-danger" aria-label="Remove variant"><Trash2 className="size-3.5" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-fg-muted">Modifier groups <span className="font-normal text-fg-subtle">· add-ons shown in POS</span></legend>
              <ul className="space-y-1.5">
                {groups.map((g) => {
                  const on = selected.includes(g.id);
                  return (
                    <li key={g.id}>
                      <Controller control={control} name="modifierGroupIds" render={({ field }) => (
                        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line px-3 py-2 text-[13px] transition-colors has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40">
                          <input type="checkbox" className="mt-0.5 size-3.5 accent-[var(--brand)]" checked={on} onChange={(e) => field.onChange(e.target.checked ? [...(field.value ?? []), g.id] : (field.value ?? []).filter((x: string) => x !== g.id))} />
                          <span><span className="font-medium">{g.name}</span><span className="block text-xs text-fg-muted">{g.modifiers.map((m) => `${m.name} +${formatMoney(m.price)}`).join(" · ")}</span></span>
                        </label>
                      )} />
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-fg-subtle">Creating custom modifier groups is coming soon.</p>
            </fieldset>

            <div>
              <span className="mb-1 block text-xs font-medium text-fg-muted">Image</span>
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-line-strong px-3 py-3 text-[13px] text-fg-muted"><ImagePlus className="size-4 text-fg-subtle" /> Photo upload is coming soon.</div>
            </div>
          </SheetBody>
          <SheetFooter className="justify-end">
            <Button type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>{item ? "Save changes" : "Create item"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
