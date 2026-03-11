import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface OnboardPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ ticket?: string; prefill?: string; mode?: string }>;
}

export default async function OnboardPage({ params, searchParams }: OnboardPageProps) {
  const { token } = await params;
  const { ticket, prefill, mode } = await searchParams;

  // Validate UUID format to prevent injection
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(token)) {
    return <ErrorCard message="Invalid or expired link." />;
  }

  // Look up session
  const { data: session, error } = await supabase
    .from("onboarding_sessions")
    .select("id, sign_in_token, expires_at, used")
    .eq("id", token)
    .single();

  if (error || !session) {
    return <ErrorCard message="This link is invalid or has already been used." />;
  }

  if (session.used) {
    return <ErrorCard message="This link has already been used. Please request a new one." />;
  }

  if (new Date(session.expires_at) < new Date()) {
    return <ErrorCard message="This link has expired. Please request a new one." />;
  }

  // Mark used BEFORE redirect — prevents replay
  await supabase
    .from("onboarding_sessions")
    .update({ used: true, used_at: new Date().toISOString() })
    .eq("id", token);

  // Build Clerk sign-in URL with ticket
  const signInTicket = ticket ?? session.sign_in_token;
  const afterSignInParams = new URLSearchParams();
  if (prefill) afterSignInParams.set("prefill", prefill);
  if (mode) afterSignInParams.set("mode", mode);

  const afterSignInPath =
    afterSignInParams.toString()
      ? `/dashboard/setup/entry?${afterSignInParams.toString()}`
      : "/dashboard/setup/entry";

  // Clerk accepts __clerk_ticket param on the sign-in page to auto-authenticate
  const signInUrl = `/sign-in#/?redirect_url=${encodeURIComponent(afterSignInPath)}&__clerk_ticket=${encodeURIComponent(signInTicket)}`;

  redirect(signInUrl);
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full mx-4 text-center">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-black mb-2">Link Unavailable</h1>
        <p className="text-gray-500 text-sm mb-6">{message}</p>
        <a
          href="https://fanout.digital"
          className="inline-block bg-black text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
        >
          Go to Fanout
        </a>
        <p className="text-xs text-gray-400 mt-4">
          Need help?{" "}
          <a href="mailto:brad@nustack.digital" className="text-black hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
