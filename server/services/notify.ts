// Password-reset email delivery via Gmail SMTP (nodemailer).
//
// Nothing here is simulated. If the Gmail credentials are missing or rejected,
// the caller is told exactly that and no "we sent it" is ever reported.
//
// Configuration (server-side only — never sent to the browser):
//   EMAIL_USER  the Gmail address that sends the mail
//   EMAIL_PASS  a Gmail App Password (16 characters, not the account password;
//               requires 2-Step Verification on the account)
//   EMAIL_FROM  the From header, e.g. "CareScribe <you@gmail.com>"

import nodemailer, { type Transporter } from 'nodemailer';

const env = (name: string): string => (process.env[name] || '').trim();

/**
 * Gmail shows an App Password as four groups of four ("abcd efgh ijkl mnop"),
 * and that is how it gets pasted into .env — but the SMTP AUTH exchange needs
 * the sixteen characters with no spaces, so Gmail answers a copied-as-shown
 * value with "Username and Password not accepted". Strip the whitespace here
 * rather than making every deployment remember to.
 */
const appPassword = (): string => env('EMAIL_PASS').replace(/\s+/g, '');

const REQUIRED = ['EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM'] as const;

/**
 * What the person resetting their password is told when the mail cannot go out.
 *
 * Deliberately says nothing about SMTP, credentials or configuration: the
 * detail belongs in the server log, where the operator can act on it, not in a
 * response to an unauthenticated visitor.
 */
export const SEND_FAILED_MESSAGE = 'Unable to send reset email. Please try again later.';

export interface EmailStatus {
  configured: boolean;
  /** Operator-facing diagnosis for the server log. Never sent to the client. */
  reason?: string;
}

export function emailStatus(): EmailStatus {
  const missing = REQUIRED.filter(name => !env(name));
  if (!missing.length) return { configured: true };
  return {
    configured: false,
    reason:
      'Password reset email is not configured on the server. Set ' +
      missing.join(', ') +
      ' in the server .env file (EMAIL_PASS must be a Gmail App Password), then restart the API.',
  };
}

// One transport, reused. Gmail's own service preset handles host/port/TLS, so
// there is nothing to get wrong in the connection settings.
let transport: Transporter | null = null;

function getTransport(): Transporter {
  if (!transport) {
    transport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: env('EMAIL_USER'), pass: appPassword() },
    });
  }
  return transport;
}

/** Drop the cached transport (used after a config change or an auth failure). */
export function resetTransport(): void {
  transport = null;
  lastCheck = null;
}

/**
 * Ask Gmail to accept the credentials without sending anything.
 *
 * Run at startup so a wrong App Password shows up in the server log immediately,
 * rather than as a mystery failure the first time a doctor tries to reset.
 */
export async function verifyEmailTransport(): Promise<EmailStatus> {
  const status = emailStatus();
  if (!status.configured) return status;
  try {
    await getTransport().verify();
    return { configured: true };
  } catch (err: any) {
    resetTransport();
    return { configured: false, reason: describeSmtpError(err) };
  }
}

// Result of the last verify(), reused briefly so a check before every reset
// request does not mean an SMTP handshake every time.
let lastCheck: { at: number; status: EmailStatus } | null = null;
const CHECK_TTL_MS = 60000;

/**
 * Verify the credentials, at most once a minute.
 *
 * Callers run this BEFORE looking the account up, so a broken configuration
 * answers identically whether or not the address is registered. Checking after
 * the lookup leaked account existence: an unknown address got the generic
 * "if that email has an account…" reply while a real one surfaced the SMTP
 * error, and the difference alone was enough to enumerate users.
 */
export async function ensureEmailReady(): Promise<EmailStatus> {
  const now = Date.now();
  if (lastCheck && now - lastCheck.at < CHECK_TTL_MS) return lastCheck.status;
  const status = await verifyEmailTransport();
  lastCheck = { at: now, status };
  return status;
}

/**
 * Turn a nodemailer/Gmail failure into something actionable, without ever
 * echoing the credentials back.
 */
function describeSmtpError(err: any): string {
  const raw = String(err?.response || err?.message || err || '');
  if (/invalid login|username and password not accepted|535|BadCredentials/i.test(raw)) {
    return 'Gmail rejected the credentials. EMAIL_PASS must be a 16-character Gmail App Password (with 2-Step Verification enabled on EMAIL_USER), not the normal account password.';
  }
  if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ECONNRESET/i.test(raw)) {
    return 'Could not reach Gmail SMTP. Check the server network connection or firewall (outbound port 465/587) and try again.';
  }
  if (/rate|limit|quota|too many/i.test(raw)) {
    return 'Gmail is rate-limiting this account. Please wait a few minutes and try again.';
  }
  return `Gmail SMTP error: ${raw.slice(0, 200)}`;
}

/** Hide most of an address so it can be shown back without exposing it. */
export function maskEmail(address: string): string {
  const [user = '', domain = ''] = String(address).split('@');
  const head = user.slice(0, 1);
  const tail = user.length > 1 ? user.slice(-1) : '';
  return `${head}${'•'.repeat(Math.max(1, user.length - 2))}${tail}@${domain}`;
}

/**
 * Send the reset link. Throws when the channel is not configured or Gmail
 * refuses it — the caller must never claim an email went out that did not.
 */
export async function sendResetLink(to: string, link: string, minutes: number): Promise<void> {
  const status = emailStatus();
  if (!status.configured) {
    const err: any = new Error(status.reason);
    err.notConfigured = true;
    throw err;
  }

  const text =
    `Reset your CareScribe password using this link:\n\n${link}\n\n` +
    `The link expires in ${minutes} minutes and can be used once. ` +
    `If you did not request this, you can ignore this email — your password has not changed.`;

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;line-height:1.6">
  <p style="margin:0 0 16px">Use the button below to set a new CareScribe password.</p>
  <p style="margin:0 0 20px">
    <a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Reset your password</a>
  </p>
  <p style="margin:0 0 8px;color:#475569;font-size:13px">Or paste this link into your browser:</p>
  <p style="margin:0 0 20px;color:#6d28d9;font-size:13px;word-break:break-all">${link}</p>
  <p style="margin:0 0 6px;color:#475569;font-size:13px">It expires in ${minutes} minutes and can be used once.</p>
  <p style="margin:0;color:#475569;font-size:13px">If you did not request this, you can ignore this email — your password has not changed.</p>
</div>`;

  try {
    await getTransport().sendMail({
      from: env('EMAIL_FROM'),
      to,
      subject: 'Reset your CareScribe password',
      text,
      html,
    });
  } catch (err: any) {
    resetTransport();
    const wrapped: any = new Error(describeSmtpError(err));
    wrapped.deliveryFailed = true;
    throw wrapped;
  }
}
