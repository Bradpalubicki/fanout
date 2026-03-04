"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function CancelPostButton({ postId }: { postId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCancel() {
    if (!confirm("Cancel this scheduled post?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/post/${postId}/cancel`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs h-7 px-2"
      onClick={handleCancel}
      disabled={loading}
    >
      {loading ? "Cancelling…" : "Cancel"}
    </Button>
  );
}
