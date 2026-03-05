import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign In — Fanout",
  description: "Sign in to your Fanout account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignIn />
    </div>
  );
}
