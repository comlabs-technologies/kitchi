import { PageBody, PageHeader, Kbd } from "@/components/ui/primitives";

export const metadata = { title: "Help" };

const SHORTCUTS: [string, string[]][] = [
  ["Open command palette", ["Ctrl/⌘", "K"]], ["Ask Kitchi", ["Ctrl/⌘", "J"]], ["POS · search items", ["/"]], ["POS · charge", ["Ctrl/⌘", "Enter"]], ["POS · send KOT", ["Alt", "K"]],
  ["POS · hold order", ["Alt", "H"]], ["POS · discount", ["Alt", "D"]], ["POS · customer", ["Alt", "C"]], ["POS · note", ["Alt", "N"]], ["POS · order type", ["Alt", "1 / 2 / 3"]], ["Payment · choose method", ["1", "2", "3", "4"]],
];

export default function HelpPage() {
  return (
    <>
      <PageHeader title="Help" description="Shortcuts and how Kitchi works." />
      <PageBody>
        <div className="grid max-w-4xl gap-10 md:grid-cols-2">
          <section>
            <h2 className="mb-3 text-[13px] font-semibold">Keyboard shortcuts</h2>
            <dl className="divide-y divide-line border-y border-line">{SHORTCUTS.map(([a, k]) => <div key={a} className="flex items-center justify-between py-2 text-[13px]"><dt className="text-fg-muted">{a}</dt><dd className="flex gap-1">{k.map((x) => <Kbd key={x}>{x}</Kbd>)}</dd></div>)}</dl>
          </section>
          <section className="space-y-5 text-[13px] leading-relaxed text-fg-muted">
            <div><h2 className="mb-1 text-[13px] font-semibold text-fg">A typical dine-in service</h2><ol className="list-decimal space-y-1 pl-4"><li>Tables → pick a free table → <b className="text-fg">Start order</b>.</li><li>Add items in POS and press <b className="text-fg">KOT</b>. The kitchen sees it instantly.</li><li>Kitchen marks it ready, then served.</li><li>Open the table, <b className="text-fg">Charge</b>, take payment, then <b className="text-fg">Close table</b>.</li></ol></div>
            <div><h2 className="mb-1 text-[13px] font-semibold text-fg">Working offline</h2><p>If the connection drops, POS keeps recording orders on this device and syncs them when you&apos;re back online. Orders can&apos;t be duplicated by a retry.</p></div>
            <div><h2 className="mb-1 text-[13px] font-semibold text-fg">Need something else?</h2><p>Write to <a className="font-medium text-brand hover:underline" href="mailto:support@kitchi.app">support@kitchi.app</a>.</p></div>
          </section>
        </div>
      </PageBody>
    </>
  );
}
