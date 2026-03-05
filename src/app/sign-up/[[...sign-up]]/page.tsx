import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign Up — Fanout",
  description: "Create your free Fanout account. 14-day free trial, no credit card required.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignUp />
    </div>
  );
}
