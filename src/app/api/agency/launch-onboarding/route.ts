import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

// FANOUT_AGENCY_KEY — 32-char hex secret shared with NuStack Agency Engine.
// Generated value: 398881e3307280b857f35c1d4d4d9599
// Add to Vercel env vars: FANOUT_AGENCY_KEY=398881e3307280b857f35c1d4d4d9599

export const dynamic = "force-dynamic";

const LaunchOnboardingSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200).optional(),
  org_id: z.string().min(1).max(200).optional(),
  prefill: z.object({
    business_name: z.string().min(1).max(200).optional(),
    website: z.string().url().optional(),
    industry: z.string().min(1).max(100).optional(),
    client_type: z.enum(["direct", "api"]).optional(),
  }).optional(),
});

export async function POST(request: Request) {
  const agencyKey = process.env.FANOUT_AGENCY_KEY;
  const incoming = request.headers.get("x-fanout-agency-key");

  if (!agencyKey || incoming !== agencyKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = LaunchOnboardingSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const body = parsed.data;

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    return NextResponse.json({ error: "Clerk not configured" }, { status: 500 });
  }

  // 1. Create or look up user in Clerk via Backend API
  let clerkUserId: string;
  try {
    // Try to find existing user
    const findRes = await fetch(
      `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(body.email)}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    const findData = (await findRes.json()) as Array<{ id: string }>;
    if (Array.isArray(findData) && findData.length > 0 && findData[0].id) {
      clerkUserId = findData[0].id;
    } else {
      // Create new user
      const createRes = await fetch("https://api.clerk.com/v1/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_address: [body.email],
          first_name: body.name?.split(" ")[0] ?? "",
          last_name: body.name?.split(" ").slice(1).join(" ") ?? "",
          skip_password_requirement: true,
          skip_password_checks: true,
        }),
      });
      const createData = (await createRes.json()) as { id?: string; errors?: unknown[] };
      if (!createData.id) {
        return NextResponse.json(
          { error: "Failed to create Clerk user", details: createData },
          { status: 500 }
        );
      }
      clerkUserId = createData.id;
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Clerk API error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }

  // 2. Create Clerk sign-in token (magic link ticket)
  let signInToken: string;
  let expiresAt: Date;
  try {
    const tokenRes = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: clerkUserId,
        expires_in_seconds: 86400, // 24 hours
      }),
    });
    const tokenData = (await tokenRes.json()) as { token?: string; expires_at?: number; errors?: unknown[] };
    if (!tokenData.token) {
      return NextResponse.json(
        { error: "Failed to create sign-in token", details: tokenData },
        { status: 500 }
      );
    }
    signInToken = tokenData.token;
    expiresAt = tokenData.expires_at
      ? new Date(tokenData.expires_at * 1000)
      : new Date(Date.now() + 86400 * 1000);
  } catch (err) {
    return NextResponse.json(
      { error: "Token creation error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }

  // 3. Store onboarding session in Supabase
  const { data: session, error: dbErr } = await supabase
    .from("onboarding_sessions")
    .insert({
      user_id: clerkUserId,
      org_id: body.org_id ?? null,
      prefill_json: body.prefill ?? null,
      sign_in_token: signInToken,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (dbErr || !session) {
    return NextResponse.json(
      { error: "Failed to store onboarding session", details: dbErr?.message },
      { status: 500 }
    );
  }

  // 4. Build magic link URL — /onboard/[token] validates and redirects
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fanout.digital";
  const prefillParam = body.prefill
    ? `&prefill=${encodeURIComponent(JSON.stringify(body.prefill))}`
    : "";
  const modeParam = body.prefill?.client_type === "api" ? "&mode=api" : "";
  const magicLink = `${baseUrl}/onboard/${session.id}?ticket=${encodeURIComponent(signInToken)}${prefillParam}${modeParam}`;

  // 5. Send email via Resend
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && !resendKey.includes("placeholder")) {
    const resend = new Resend(resendKey);
    const businessName = body.prefill?.business_name ?? body.name ?? "your business";
    const recipientName = body.name?.split(" ")[0] ?? "there";

    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #000; padding: 16px 24px; border-radius: 12px; margin-bottom: 32px; display: inline-block;">
          <span style="color: #fff; font-size: 22px; font-weight: 900; letter-spacing: -1px;">Fanout</span>
        </div>

        <h1 style="font-size: 26px; font-weight: 800; color: #000; margin: 0 0 8px;">Welcome, ${recipientName}.</h1>
        <p style="color: #666; font-size: 16px; margin: 0 0 8px;">
          Your Fanout account for <strong>${businessName}</strong> is ready to set up.
        </p>
        <p style="color: #888; font-size: 14px; margin: 0 0 32px;">
          Click the button below to sign in and complete your social media setup. No password needed.
        </p>

        <a href="${magicLink}"
           style="display: inline-block; background: #000; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; margin-bottom: 24px;">
          Set Up My Account &rarr;
        </a>

        <p style="color: #999; font-size: 13px; line-height: 1.6; margin: 0 0 8px;">
          This link expires in 24 hours and can only be used once.
        </p>
        <p style="color: #999; font-size: 13px; line-height: 1.6;">
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
        to: body.email,
        subject: `${recipientName}, your Fanout account is ready`,
        html,
      });
    } catch {
      // Email send failure is non-fatal — return success with warning
      return NextResponse.json({
        sent: false,
        warning: "Email send failed — magic link still valid",
        magic_link: magicLink,
        session_id: session.id,
        expires_at: expiresAt.toISOString(),
      });
    }
  }

  return NextResponse.json({
    sent: true,
    session_id: session.id,
    expires_at: expiresAt.toISOString(),
  });
}
