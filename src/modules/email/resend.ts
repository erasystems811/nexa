import "server-only";

import { serverEnv } from "@/lib/env";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const env = serverEnv();

  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error("Resend email is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend email failed: ${detail}`);
  }
}

export async function sendSignupConfirmationEmail(input: {
  to: string;
  name?: string;
  confirmationUrl: string;
}): Promise<void> {
  const firstName = input.name?.trim().split(/\s+/)[0] || "there";

  await sendEmail({
    to: input.to,
    subject: "Confirm your Nexa account",
    text: `Hi ${firstName},\n\nConfirm your Nexa account with this link:\n${input.confirmationUrl}\n\nIf you did not create a Nexa account, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0b1524">
        <h1 style="font-size:24px;margin-bottom:12px">Confirm your Nexa account</h1>
        <p>Hi ${escapeHtml(firstName)},</p>
        <p>Tap the button below to confirm your account and continue planning your event on Nexa.</p>
        <p style="margin:24px 0">
          <a href="${input.confirmationUrl}" style="background:#0f2f5f;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:600">Confirm account</a>
        </p>
        <p style="font-size:13px;color:#64748b">If the button does not work, copy this link into your browser:<br>${input.confirmationUrl}</p>
      </div>
    `,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
