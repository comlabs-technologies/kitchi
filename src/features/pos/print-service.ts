import { formatMoneyPrecise } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import type { Order } from "@/types/domain";

/**
 * Printing boundary. The MVP ships a browser implementation (hidden iframe → window.print);
 * ESC/POS network/USB printers implement the same interface later.
 */
export interface PrintService {
  printReceipt(order: Order, meta: ReceiptMeta): Promise<void>;
  printKOT(order: Order, meta: ReceiptMeta): Promise<void>;
}
export interface ReceiptMeta {
  restaurant: string;
  outlet: string;
  address?: string;
  gstin?: string;
  footer?: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function docFor(body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Print</title><style>
  @page{size:80mm auto;margin:4mm}
  body{font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#000;width:72mm;margin:0}
  h1{font-size:15px;margin:0;text-align:center} .c{text-align:center} .r{text-align:right}
  hr{border:0;border-top:1px dashed #000;margin:6px 0} table{width:100%;border-collapse:collapse} td{vertical-align:top;padding:1px 0}
  .b{font-weight:700} .big{font-size:16px} .sm{font-size:10.5px}
  </style></head><body>${body}</body></html>`;
}

export function receiptHtml(o: Order, m: ReceiptMeta): string {
  const rows = o.items
    .map((i) => `<tr><td>${i.qty} × ${esc(i.name)}${i.variantName ? ` (${esc(i.variantName)})` : ""}${i.modifiers.map((x) => `<div class="sm">+ ${esc(x.name)}</div>`).join("")}</td><td class="r">${formatMoneyPrecise(i.unitPrice * i.qty)}</td></tr>`)
    .join("");
  const pays = o.payments.map((p) => `<tr><td>${p.method}</td><td class="r">${formatMoneyPrecise(p.amount)}</td></tr>`).join("");
  return `<h1>${esc(m.restaurant)}</h1><div class="c sm">${esc(m.outlet)}${m.address ? `<br>${esc(m.address)}` : ""}${m.gstin ? `<br>GSTIN ${esc(m.gstin)}` : ""}</div><hr>
  <div>Order #${o.number} · ${o.type.replace("_", " ")}${o.tableName ? ` · ${esc(o.tableName)}` : ""}<br>${formatDateTime(o.createdAt)}${o.customerName ? `<br>${esc(o.customerName)}` : ""}</div><hr>
  <table>${rows}</table><hr><table>
  <tr><td>Subtotal</td><td class="r">${formatMoneyPrecise(o.subtotal)}</td></tr>
  ${o.discount ? `<tr><td>Discount</td><td class="r">-${formatMoneyPrecise(o.discount)}</td></tr>` : ""}
  <tr><td>GST</td><td class="r">${formatMoneyPrecise(o.tax)}</td></tr>
  ${o.roundOff ? `<tr><td>Round off</td><td class="r">${formatMoneyPrecise(o.roundOff)}</td></tr>` : ""}
  <tr class="b big"><td>Total</td><td class="r">${formatMoneyPrecise(o.total)}</td></tr></table><hr>
  <table>${pays}</table><hr><div class="c">${esc(m.footer ?? "Thank you!")}</div>`;
}

export function kotHtml(o: Order, m: ReceiptMeta): string {
  const rows = o.items
    .map((i) => `<div class="b big">${i.qty} × ${esc(i.name)}${i.variantName ? ` (${esc(i.variantName)})` : ""}</div>${i.modifiers.map((x) => `<div>+ ${esc(x.name)}</div>`).join("")}${i.note ? `<div>* ${esc(i.note)}</div>` : ""}`)
    .join("<hr>");
  return `<div class="c b">KOT · ${esc(m.outlet)}</div><div class="c big b">#${o.number}</div><div class="c">${o.type.replace("_", " ")}${o.tableName ? ` · ${esc(o.tableName)}` : ""} · ${formatDateTime(o.createdAt)}</div><hr>${rows}${o.note ? `<hr><div class="b">NOTE: ${esc(o.note)}</div>` : ""}`;
}

function printHtml(html: string): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(docFor(html));
    doc.close();
    const done = () => {
      setTimeout(() => frame.remove(), 500);
      resolve();
    };
    frame.onload = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      done();
    };
    setTimeout(() => {
      if (frame.isConnected) {
        frame.contentWindow?.print();
        done();
      }
    }, 600);
  });
}

export const browserPrintService: PrintService = {
  printReceipt: (o, m) => printHtml(receiptHtml(o, m)),
  printKOT: (o, m) => printHtml(kotHtml(o, m)),
};
