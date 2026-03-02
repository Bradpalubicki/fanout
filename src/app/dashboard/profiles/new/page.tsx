"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  webhookUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  timezone: z.string(),
});

type FormData = z.infer<typeof schema>;

export default function NewProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { timezone: "UTC" },
  });

  const nameToSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json() as { error?: string; apiKey?: string; profile?: { id: string } };

      if (!res.ok) {
        toast.error(json.error ?? "Failed to create profile");
        return;
      }

      setGeneratedKey(json.apiKey ?? null);
      toast.success("Profile created!");

      setTimeout(() => {
        router.push(`/dashboard/profiles/${(json.profile as { id: string }).id}`);
      }, 3000);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (generatedKey) {
    return (
      <div className="p-6 max-w-xl">
        <Card className="p-6 border-green-200 bg-green-50">
          <h2 className="font-bold text-green-900 mb-2">Profile created!</h2>
          <p className="text-green-700 text-sm mb-4">
            Save this API key — it won&apos;t be shown again.
          </p>
          <div className="bg-white rounded-lg p-3 font-mono text-sm break-all border border-green-200 mb-4">
            {generatedKey}
          </div>
          <p className="text-xs text-green-600">Redirecting to profile in 3 seconds...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold text-black mb-2">New profile</h1>
      <p className="text-gray-500 text-sm mb-8">Create a profile for a client to manage their social accounts.</p>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Profile name</Label>
          <Input
            id="name"
            placeholder="AK Dental"
            {...form.register("name")}
            onChange={(e) => {
              form.setValue("name", e.target.value);
              if (!form.formState.dirtyFields.slug) {
                form.setValue("slug", nameToSlug(e.target.value));
              }
            }}
          />
          {form.formState.errors.name && (
            <p className="text-red-500 text-xs">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Profile slug</Label>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">fanout.digital/</span>
            <Input
              id="slug"
              placeholder="ak-dental"
              {...form.register("slug")}
              className="flex-1"
            />
          </div>
          {form.formState.errors.slug && (
            <p className="text-red-500 text-xs">{form.formState.errors.slug.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="webhookUrl">Webhook URL (optional)</Label>
          <Input
            id="webhookUrl"
            placeholder="https://your-engine.vercel.app/api/webhooks/fanout"
            {...form.register("webhookUrl")}
          />
          <p className="text-xs text-gray-400">Called after each post completes with results.</p>
          {form.formState.errors.webhookUrl && (
            <p className="text-red-500 text-xs">{form.formState.errors.webhookUrl.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full bg-black text-white hover:bg-gray-800" disabled={loading}>
          {loading ? "Creating..." : "Create profile"}
        </Button>
      </form>
    </div>
  );
}
