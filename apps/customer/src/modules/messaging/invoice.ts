import "server-only";

import { serverEnv } from "@/lib/env";

/**
 * Renders a vendor's approved invoice draft into a real PDF via Gotenberg
 * (self-hosted HTML->PDF, see GOTENBERG_URL), then hands it to WhatsApp as a
 * document the customer can open directly in the chat. This is deliberately
 * a flat, single-purpose module - the only two things anything else needs
 * from here are "make the PDF bytes" and "get it onto WhatsApp".
 */

function invoiceHtml(input: {
  vendorName: string;
  item: string;
  amountKobo: number;
  customerName: string;
  reference: string;
}): string {
  const amountNaira = (input.amountKobo / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const issuedAt = new Date().toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" });

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; padding: 48px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #666; font-size: 13px; }
  .card { border: 1px solid #e2e2e2; border-radius: 10px; padding: 24px; margin-top: 32px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { text-align: left; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 14px; }
  .total-row td { border-bottom: none; font-weight: bold; font-size: 16px; padding-top: 16px; }
  .footer { margin-top: 32px; font-size: 12px; color: #888; }
</style>
</head>
<body>
  <h1>Invoice</h1>
  <p class="muted">Ref: ${input.reference} &middot; Issued ${issuedAt}</p>

  <div class="card">
    <p><strong>From:</strong> ${input.vendorName}</p>
    <p><strong>To:</strong> ${input.customerName}</p>

    <table>
      <thead>
        <tr><th>Item</th><th>Amount</th></tr>
      </thead>
      <tbody>
        <tr><td>${input.item}</td><td>&#8358;${amountNaira}</td></tr>
        <tr class="total-row"><td>Total</td><td>&#8358;${amountNaira}</td></tr>
      </tbody>
    </table>
  </div>

  <p class="footer">
    Nexa holds this payment in escrow until the event is completed - the vendor is paid
    only once you confirm the job is done. Reply with your event date and time on WhatsApp
    to get your payment link.
  </p>
</body>
</html>`;
}

async function renderInvoicePdf(input: {
  vendorName: string;
  item: string;
  amountKobo: number;
  customerName: string;
  reference: string;
}): Promise<Buffer> {
  const env = serverEnv();
  if (!env.GOTENBERG_URL) throw new Error("GOTENBERG_URL is not configured");

  // Gotenberg v8's form field is generically named "files" - it identifies
  // the HTML entry point by filename ("index.html"), not by the field name.
  const form = new FormData();
  form.append("files", new Blob([invoiceHtml(input)], { type: "text/html" }), "index.html");

  const headers: Record<string, string> = {};
  if (env.GOTENBERG_USERNAME && env.GOTENBERG_PASSWORD) {
    headers.Authorization = `Basic ${Buffer.from(`${env.GOTENBERG_USERNAME}:${env.GOTENBERG_PASSWORD}`).toString("base64")}`;
  }

  const response = await fetch(`${env.GOTENBERG_URL}/forms/chromium/convert/html`, {
    method: "POST",
    headers,
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Gotenberg render failed: ${response.status} ${await response.text()}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function uploadWhatsappMedia(pdf: Buffer, filename: string): Promise<string> {
  const env = serverEnv();
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error("WhatsApp is not configured");
  }

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "application/pdf");
  form.append("file", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), filename);

  const response = await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
    body: form,
  });

  const detail = await response.text();
  if (!response.ok) throw new Error(`WhatsApp media upload failed: ${detail}`);

  const { id } = JSON.parse(detail) as { id: string };
  return id;
}

async function sendWhatsappDocument(input: { to: string; mediaId: string; filename: string; caption: string }): Promise<void> {
  const env = serverEnv();
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return;

  const response = await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: input.to,
      type: "document",
      document: { id: input.mediaId, filename: input.filename, caption: input.caption },
    }),
  });

  if (!response.ok) {
    throw new Error(`WhatsApp document send failed: ${await response.text()}`);
  }
}

/**
 * Renders the invoice and delivers it to the customer as a WhatsApp document.
 * `caption` carries the "reply with your date/time" instruction - the invoice
 * PDF itself never asks for anything back, it's just the bill.
 */
export async function sendInvoiceToCustomer(input: {
  to: string;
  vendorName: string;
  item: string;
  amountKobo: number;
  customerName: string;
  reference: string;
  caption: string;
}): Promise<void> {
  const pdf = await renderInvoicePdf(input);
  const mediaId = await uploadWhatsappMedia(pdf, `invoice-${input.reference}.pdf`);
  await sendWhatsappDocument({
    to: input.to,
    mediaId,
    filename: `Nexa-Invoice-${input.reference}.pdf`,
    caption: input.caption,
  });
}
