"use client";
import * as React from "react";
import Link from "next/link";
import * as D from "@radix-ui/react-dialog";
import { ArrowRight, CornerDownLeft, Loader2, Sparkles } from "lucide-react";
import { useUI } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { askKitchiAction } from "@/server/actions/ops";
import type { AIAnswer } from "@/server/ai/provider";

const SUGGESTIONS = ["How are we doing today?", "What's running low?", "What sold the most today?", "How much did we collect in cash?", "Compare today with yesterday"];

interface Turn {
  q: string;
  a?: AIAnswer;
  pending?: boolean;
}

export function AskKitchi({ canAsk }: { canAsk: boolean }) {
  const open = useUI((s) => s.askOpen);
  const setOpen = useUI((s) => s.setAsk);
  const seed = useUI((s) => s.askSeed);
  const [q, setQ] = React.useState("");
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const scroller = React.useRef<HTMLDivElement>(null);

  const ask = React.useCallback(async (text: string) => {
    const question = text.trim();
    if (!question) return;
    setQ("");
    setTurns((t) => [...t, { q: question, pending: true }]);
    let a: AIAnswer;
    try {
      a = await askKitchiAction(question);
    } catch {
      a = { text: "I couldn't reach Kitchi just now. Try again in a moment.", toolsUsed: [] };
    }
    setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { q: question, a } : x)));
  }, []);

  React.useEffect(() => {
    if (open && seed) void ask(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed]);
  React.useEffect(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }), [turns]);

  if (!canAsk) return null;
  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Portal>
        <D.Overlay className="anim-overlay fixed inset-0 z-50 bg-[rgba(20,20,18,0.32)]" />
        <D.Content className="anim-pop fixed left-1/2 top-[10vh] z-50 flex max-h-[78vh] w-[calc(100vw-24px)] max-w-[600px] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-pop focus:outline-none">
          <D.Title className="sr-only">Ask Kitchi</D.Title>
          <D.Description className="sr-only">Ask a question about your restaurant</D.Description>
          <form className="flex items-center gap-2.5 border-b border-line px-4" onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
            <Sparkles className="size-4 text-brand" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about sales, orders, stock…" aria-label="Ask Kitchi" className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg-subtle" maxLength={300} />
            <button type="submit" disabled={!q.trim()} className="grid size-7 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-muted hover:text-fg disabled:opacity-40" aria-label="Send"><CornerDownLeft className="size-3.5" /></button>
          </form>
          <div ref={scroller} className="scroll-thin min-h-[160px] flex-1 overflow-y-auto p-4">
            {turns.length === 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium text-fg-muted">Try asking</p>
                <div className="flex flex-col">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => void ask(s)} className="group flex items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-muted">
                      {s}
                      <ArrowRight className="size-3.5 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ol className="space-y-5">
                {turns.map((t, i) => (
                  <li key={i}>
                    <p className="text-[13px] font-medium">{t.q}</p>
                    {t.pending ? (
                      <p className="mt-2 flex items-center gap-2 text-[13px] text-fg-muted"><Loader2 className="size-3.5 animate-spin" /> Checking your numbers…</p>
                    ) : (
                      t.a && (
                        <div className="mt-1.5">
                          <p className="text-[13.5px] leading-relaxed text-fg">{t.a.text}</p>
                          {t.a.facts && (
                            <dl className="mt-2.5 divide-y divide-line rounded-lg border border-line">
                              {t.a.facts.map((f) => (
                                <div key={f.label} className="flex items-center justify-between gap-4 px-3 py-1.5 text-[13px]">
                                  <dt className="text-fg-muted">{f.label}</dt>
                                  <dd className={cn("tnum font-medium", f.tone === "up" && "text-ok", f.tone === "down" && "text-danger", f.tone === "warn" && "text-warn")}>{f.value}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                          <div className="mt-2 flex items-center justify-between text-xs text-fg-subtle">
                            <span>{t.a.toolsUsed.length ? `Source: ${t.a.toolsUsed.join(", ")}` : ""}</span>
                            {t.a.link && <Link href={t.a.link.href} onClick={() => setOpen(false)} className="inline-flex items-center gap-1 font-medium text-brand hover:underline">{t.a.link.label} <ArrowRight className="size-3" /></Link>}
                          </div>
                        </div>
                      )
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
