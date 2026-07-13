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

export async function sendSignupVerificationCode(input: {
  to: string;
  name?: string;
  code: string;
}): Promise<void> {
  const firstName = input.name?.trim().split(/\s+/)[0] || "there";
  const code = input.code.trim();

  await sendEmail({
    to: input.to,
    subject: "Your Nexa verification code",
    text: `Hi ${firstName},\n\nYour Nexa verification code is ${code}.\n\nEnter this code in Nexa to finish creating your account. If you did not create a Nexa account, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0b1524">
        <h1 style="font-size:24px;margin-bottom:12px">Your Nexa verification code</h1>
        <p>Hi ${escapeHtml(firstName)},</p>
        <p>Enter this code in Nexa to finish creating your account:</p>
        <p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:24px 0;color:#0f2f5f">${escapeHtml(code)}</p>
        <p style="font-size:13px;color:#64748b">If you did not create a Nexa account, you can ignore this email.</p>
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
