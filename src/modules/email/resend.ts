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

/** Someone asked to reset their own password from /reset. */
export async function sendPasswordResetCode(input: {
  to: string;
  name?: string;
  code: string;
  actionUrl: string;
}): Promise<void> {
  const firstName = input.name?.trim().split(/\s+/)[0] || "there";
  const code = input.code.trim();

  await sendEmail({
    to: input.to,
    subject: "Your Nexa password reset code",
    text: `Hi ${firstName},\n\nYour Nexa password reset code is ${code}.\n\nOpen ${input.actionUrl} and enter this code to choose a new password. If you did not ask to reset your Nexa password, you can ignore this email — your password stays as it is.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0b1524">
        <h1 style="font-size:24px;margin-bottom:12px">Your Nexa password reset code</h1>
        <p>Hi ${escapeHtml(firstName)},</p>
        <p>Enter this code in Nexa to choose a new password:</p>
        <p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:24px 0;color:#0f2f5f">${escapeHtml(code)}</p>
        <p><a href="${escapeHtml(input.actionUrl)}" style="color:#0f2f5f">Reset your password</a></p>
        <p style="font-size:13px;color:#64748b">If you did not ask to reset your Nexa password, you can ignore this email — your password stays as it is.</p>
      </div>
    `,
  });
}

/**
 * An admin created this account (a vendor or a staff member), so it has no
 * password yet. The code below is what turns it into a login they own.
 */
export async function sendPasswordSetupCode(input: {
  to: string;
  name?: string;
  code: string;
  actionUrl: string;
}): Promise<void> {
  const firstName = input.name?.trim().split(/\s+/)[0] || "there";
  const code = input.code.trim();

  await sendEmail({
    to: input.to,
    subject: "Set your Nexa password",
    text: `Hi ${firstName},\n\nA Nexa account has been set up for you.\n\nOpen ${input.actionUrl} and enter this code to choose your password: ${code}\n\nThe code expires shortly. If it has, use "Forgot password?" on the Nexa sign-in page to get a new one.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0b1524">
        <h1 style="font-size:24px;margin-bottom:12px">Set your Nexa password</h1>
        <p>Hi ${escapeHtml(firstName)},</p>
        <p>A Nexa account has been set up for you. Enter this code in Nexa to choose your password:</p>
        <p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:24px 0;color:#0f2f5f">${escapeHtml(code)}</p>
        <p><a href="${escapeHtml(input.actionUrl)}" style="color:#0f2f5f">Set your password</a></p>
        <p style="font-size:13px;color:#64748b">The code expires shortly. If it has, use &ldquo;Forgot password?&rdquo; on the Nexa sign-in page to get a new one.</p>
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
