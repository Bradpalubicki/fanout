"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Bot,
  User,
  Send,
  Sparkles,
  CheckCircle2,
  Wrench,
  ArrowRight,
  Plug,
} from "lucide-react";
import Link from "next/link";
import { PlatformConnectWizard } from "@/components/dashboard/platform-connect-wizard";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STARTER_PROMPTS = [
  "I'm a dental office in Chicago, want to post 3x/week on LinkedIn and Instagram with a professional but friendly tone",
  "Wellness studio in Austin, want to grow on Instagram and TikTok, casual motivational content, 5x/week",
  "B2B software company, LinkedIn-focused, thought leadership content, 4x/week, technical but accessible",
  "Local restaurant in Denver, Instagram + Facebook, showcase food and events, 6x/week, vibrant and fun",
];

// Tools we consider "setup complete" when all 4 have run successfully
const REQUIRED_TOOLS = ["create_profile", "set_tone_config", "set_schedule", "generate_seed_posts"];

interface ParsedToolResult {
  success?: boolean;
  profile_id?: string;
  tone?: string;
  topics?: string[];
  message?: string;
}

function extractProfileId(toolResults: string[]): string | null {
  for (const r of toolResults) {
    if (r.includes("create_profile")) {
      const colonIdx = r.indexOf("]: ");
      const raw = colonIdx > -1 ? r.slice(colonIdx + 3) : r;
      try {
        const parsed = JSON.parse(raw) as ParsedToolResult;
        if (parsed.profile_id) return parsed.profile_id;
      } catch {
        // ignore
      }
    }
  }
  return null;
}


function checkSetupComplete(allToolResults: string[]): {
  complete: boolean;
  ranTools: string[];
} {
  const ranTools = new Set<string>();
  for (const r of allToolResults) {
    const colonIdx = r.indexOf("]: ");
    const raw = colonIdx > -1 ? r.slice(colonIdx + 3) : r;
    try {
      const parsed = JSON.parse(raw) as ParsedToolResult;
      if (parsed.success) {
        for (const tool of REQUIRED_TOOLS) {
          if (r.includes(`[${tool}]`)) ranTools.add(tool);
        }
      }
    } catch {
      // ignore
    }
  }
  // fallback: check by tool name prefix in the result string
  for (const r of allToolResults) {
    for (const tool of REQUIRED_TOOLS) {
      if (r.startsWith(`[${tool}]:`)) {
        const colonIdx = r.indexOf("]: ");
        const raw = colonIdx > -1 ? r.slice(colonIdx + 3) : r;
        try {
          const parsed = JSON.parse(raw) as ParsedToolResult;
          if (parsed.success) ranTools.add(tool);
        } catch {
          // ignore
        }
      }
    }
  }
  return {
    complete: REQUIRED_TOOLS.every((t) => ranTools.has(t)),
    ranTools: Array.from(ranTools),
  };
}

function parseToolCallBadge(raw: string): { msg: string; success: boolean } | null {
  try {
    const parsed = JSON.parse(raw) as ParsedToolResult;
    return {
      msg: (parsed.message as string | undefined) ?? raw.slice(0, 100),
      success: !!parsed.success,
    };
  } catch {
    return null;
  }
}

function ToolCallBadge({ raw }: { raw: string }) {
  const data = parseToolCallBadge(raw);
  if (!data) return null;
  const { msg, success } = data;
  return (
    <div
      className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 mt-1 ${
        success
          ? "bg-green-50 text-green-700 border border-green-100"
          : "bg-red-50 text-red-700 border border-red-100"
      }`}
    >
      {success ? (
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      ) : (
        <Wrench className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      )}
      <span>{msg}</span>
    </div>
  );
}

function MessageBubble({
  message,
  toolResults,
}: {
  message: Message;
  toolResults?: string[];
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          isUser ? "bg-black" : "bg-indigo-600"
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-white" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-white" />
        )}
      </div>
      <div className={`flex-1 ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed ${
            isUser
              ? "bg-black text-white rounded-tr-sm"
              : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
          }`}
        >
          {message.content}
        </div>
        {toolResults && toolResults.length > 0 && (
          <div className="max-w-[85%] space-y-1 pl-1">
            {toolResults.map((r, i) => {
              const colonIdx = r.indexOf("]: ");
              const raw = colonIdx > -1 ? r.slice(colonIdx + 3) : r;
              return <ToolCallBadge key={i} raw={raw} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface SetupCompleteScreenProps {
  profileId: string;
  ranTools: string[];
}

function SetupCompleteScreen({ profileId, ranTools }: SetupCompleteScreenProps) {
  const steps = [
    { tool: "create_profile", label: "Profile created" },
    { tool: "set_tone_config", label: "Brand voice configured" },
    { tool: "set_schedule", label: "Posting schedule set" },
    { tool: "generate_seed_posts", label: "5 seed posts drafted" },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Completion checklist */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-black">Setup complete</h2>
              <p className="text-xs text-gray-400">Your profile is configured and ready</p>
            </div>
          </div>
          <div className="space-y-2">
            {steps.map(({ tool, label }) => (
              <div
                key={tool}
                className="flex items-center gap-3 py-2 px-3 rounded-lg bg-green-50 border border-green-100"
              >
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm text-green-800 font-medium">{label}</span>
              </div>
            ))}
            {ranTools.length < 4 && (
              <p className="text-xs text-gray-400 px-3">
                Some steps may still be processing. Check your profile for full details.
              </p>
            )}
          </div>
        </div>

        {/* Platform wizard */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Plug className="w-4 h-4 text-black" />
            <h3 className="font-bold text-black">Now let&apos;s connect your platforms</h3>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Connect each social account so Fanout can start posting automatically. This takes 2–5 minutes total.
          </p>
          <PlatformConnectWizard
            profileId={profileId}
            initialConnected={[]}
          />
        </div>
      </div>
    </div>
  );
}

export default function SetupAgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your Fanout Setup Agent.\n\nTell me about your business and what you want from social media — platforms, posting frequency, tone, content topics — and I'll set everything up for you automatically.\n\nYou can be as specific or as casual as you like. Just describe it in plain language.",
    },
  ]);
  const [toolResultsMap, setToolResultsMap] = useState<Record<number, string[]>>({});
  const [allToolResults, setAllToolResults] = useState<string[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars -- read inside functional updater
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [setupComplete, setSetupComplete] = useState(false);
  const [completedProfileId, setCompletedProfileId] = useState<string | null>(null);
  const [ranTools, setRanTools] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  function handleStarterPrompt(prompt: string) {
    setInput(prompt);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function send() {
    const text = input.trim();
    if (!text || isPending) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");

    startTransition(async () => {
      try {
        const res = await fetch("/api/setup-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newMessages }),
        });

        const data = (await res.json()) as {
          reply?: string;
          toolResults?: string[];
          error?: string;
        };

        if (!res.ok || data.error) {
          toast.error(data.error ?? "Agent failed — try again");
          return;
        }

        const assistantMsg: Message = {
          role: "assistant",
          content: data.reply ?? "Done! Check your dashboard.",
        };

        const newIdx = newMessages.length;
        const newToolResults = data.toolResults ?? [];

        if (newToolResults.length > 0) {
          setToolResultsMap((prev) => ({ ...prev, [newIdx]: newToolResults }));
          setAllToolResults((prev) => {
            const updated = [...prev, ...newToolResults];
            const { complete, ranTools: ran } = checkSetupComplete(updated);
            if (complete) {
              const profileId = extractProfileId(updated);
              if (profileId) {
                setCompletedProfileId(profileId);
                setRanTools(ran);
                setSetupComplete(true);
              }
            }
            return updated;
          });
        }

        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        toast.error("Connection error — try again");
      }
    });
  }

  const showStarters = messages.length === 1;

  if (setupComplete && completedProfileId) {
    return (
      <div className="flex flex-col h-full max-h-screen">
        {/* Header */}
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between bg-white">
          <div>
            <h1 className="text-lg font-bold text-black flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Setup Agent
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Profile configured — now connect your platforms
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild className="text-xs gap-1.5">
              <Link href={`/dashboard/profiles/${completedProfileId}`}>
                View Profile <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </div>
        </div>
        <SetupCompleteScreen profileId={completedProfileId} ranTools={ranTools} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between bg-white">
        <div>
          <h1 className="text-lg font-bold text-black flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Setup Agent
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Tell me about your business — I&apos;ll configure everything automatically
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild className="text-xs gap-1.5">
            <Link href="/dashboard/profiles">
              View Profiles <ArrowRight className="w-3 h-3" />
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild className="text-xs gap-1.5">
            <Link href="/dashboard/ai">
              View Drafts <ArrowRight className="w-3 h-3" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 bg-gray-50/50">
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            toolResults={toolResultsMap[i]}
          />
        ))}

        {isPending && <TypingIndicator />}

        {/* Starter prompts */}
        {showStarters && (
          <div className="pt-4">
            <p className="text-xs text-gray-400 mb-3 text-center">
              Try one of these examples or type your own:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl mx-auto">
              {STARTER_PROMPTS.map((prompt) => (
                <Card
                  key={prompt}
                  onClick={() => handleStarterPrompt(prompt)}
                  className="p-3 border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 cursor-pointer transition-all text-xs text-gray-600 leading-relaxed"
                >
                  {prompt}
                </Card>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 bg-white px-6 py-4">
        <div className="flex gap-3 items-end max-w-4xl">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your business and social media goals…"
            className="flex-1 min-h-[44px] max-h-32 resize-none text-sm"
            rows={1}
            disabled={isPending}
          />
          <Button
            onClick={send}
            disabled={!input.trim() || isPending}
            className="bg-black text-white hover:bg-gray-800 shrink-0 h-11 px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Enter to send · Shift+Enter for new line · The agent may take 15-30s while it runs setup tools
        </p>
      </div>
    </div>
  );
}
