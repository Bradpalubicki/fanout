"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bot,
  User,
  Send,
  Sparkles,
  CheckCircle2,
  Wrench,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ToolResult {
  name: string;
  result: string;
}

const STARTER_PROMPTS = [
  "I'm a dental office in Chicago, want to post 3x/week on LinkedIn and Instagram with a professional but friendly tone",
  "Wellness studio in Austin, want to grow on Instagram and TikTok, casual motivational content, 5x/week",
  "B2B software company, LinkedIn-focused, thought leadership content, 4x/week, technical but accessible",
  "Local restaurant in Denver, Instagram + Facebook, showcase food and events, 6x/week, vibrant and fun",
];

function ToolCallBadge({ raw }: { raw: string }) {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const msg = (parsed.message as string) ?? raw.slice(0, 100);
    const success = !!parsed.success;
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
  } catch {
    return null;
  }
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
              const colonIdx = r.indexOf(']: ');
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

export default function SetupAgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your Fanout Setup Agent.\n\nTell me about your business and what you want from social media — platforms, posting frequency, tone, content topics — and I'll set everything up for you automatically.\n\nYou can be as specific or as casual as you like. Just describe it in plain language.",
    },
  ]);
  const [toolResultsMap, setToolResultsMap] = useState<Record<number, string[]>>({});
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
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

        const data = await res.json() as {
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

        const newIdx = newMessages.length; // index of the upcoming assistant message
        if (data.toolResults && data.toolResults.length > 0) {
          setToolResultsMap((prev) => ({ ...prev, [newIdx]: data.toolResults! }));
        }

        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        toast.error("Connection error — try again");
      }
    });
  }

  const showStarters = messages.length === 1;

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
