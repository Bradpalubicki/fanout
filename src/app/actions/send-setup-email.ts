"use server";

import { Resend } from "resend";

export interface SendSetupEmailParams {
  userEmail: string;
  userName: string;
  profileName: string;
  profileId: string;
  tone: string;
  topics: string[];
}

export async function sendSetupEmail(
  params: SendSetupEmailParams
): Promise<{ sent?: boolean; skipped?: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === "placeholder" || key.includes("placeholder")) {
    return { skipped: true };
  }

  const resend = new Resend(key);

  const topicList = params.topics.slice(0, 3).join(", ");

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="background: #000; padding: 20px 24px; border-radius: 12px; margin-bottom: 32px; display: inline-flex; align-items: center; gap: 12px;">
        <span style="color: #fff; font-size: 24px; font-weight: 900; letter-spacing: -1px;">Fanout</span>
      </div>

      <h1 style="font-size: 28px; font-weight: 800; color: #000; margin: 0 0 8px;">Your account is ready, ${params.userName}.</h1>
      <p style="color: #666; font-size: 16px; margin: 0 0 32px;">Your profile <strong>${params.profileName}</strong> is configured with a ${params.tone} voice covering ${topicList}.</p>

      <div style="background: #f9f9f9; border: 1px solid #eee; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
        <p style="font-size: 14px; font-weight: 600; color: #000; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.5px;">Connect these 3 platforms first</p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: #1d4ed8; flex-shrink: 0;"></div>
            <span style="font-size: 15px; color: #000;"><strong>LinkedIn</strong> — Best for B2B reach. Instant approval.</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: #000; flex-shrink: 0;"></div>
            <span style="font-size: 15px; color: #000;"><strong>Twitter / X</strong> — High engagement. Instant approval.</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: #f97316; flex-shrink: 0;"></div>
            <span style="font-size: 15px; color: #000;"><strong>Reddit</strong> — Massive organic reach. Self-service, no wait.</span>
          </div>
        </div>
      </div>

      <a href="https://fanout.digital/dashboard/profiles/${params.profileId}"
         style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; margin-bottom: 32px;">
        Connect Platforms Now &rarr;
      </a>

      <p style="color: #999; font-size: 13px; line-height: 1.6;">
        Note: Facebook and Instagram require Meta Business Verification (1&ndash;3 business days). We&apos;ll notify you when they&apos;re ready.<br><br>
        Questions? Reply to this email or reach us at <a href="mailto:brad@nustack.digital" style="color: #000;">brad@nustack.digital</a>
      </p>

      <div style="border-top: 1px solid #eee; margin-top: 32px; padding-top: 20px;">
        <p style="color: #ccc; font-size: 12px; margin: 0;">Fanout &middot; fanout.digital &middot; NuStack Digital Ventures LLC</p>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "Fanout <onboarding@fanout.digital>",
      to: params.userEmail,
      subject: `Your Fanout account is ready — connect your first platform`,
      html,
    });

    return { sent: true };
  } catch {
    return { error: "Email send failed" };
  }
}
