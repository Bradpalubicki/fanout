"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface WebhookLog {
  id: string;
  event_type: string;
  response_status: number | null;
  response_body: string | null;
  delivered_at: string;
  attempts: number;
}

export function WebhookLogs({ profileId, hasWebhookUrl }: { profileId: string; hasWebhookUrl: boolean }) {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/profiles/${profileId}/webhook-logs`);
      const data = await res.json() as { logs?: WebhookLog[] };
      setLogs(data.logs ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const retry = async (logId: string) => {
    setRetrying(logId);
    try {
      await fetch(`/api/dashboard/profiles/${profileId}/webhook-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      });
      await fetchLogs();
    } catch {
      // silent
    } finally {
      setRetrying(null);
    }
  };

  if (!hasWebhookUrl) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        No webhook URL configured. Add one in Settings to receive delivery logs.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">Loading logs...</div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        No webhook deliveries yet. Webhook logs appear here after posts are published.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4">Time</th>
            <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4">Event</th>
            <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4">Status</th>
            <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4">Response</th>
            <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4">Attempts</th>
            <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {logs.map((log) => {
            const isSuccess = log.response_status !== null && log.response_status >= 200 && log.response_status < 300;
            const isFailed = !isSuccess;
            return (
              <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="py-3 pr-4 text-gray-500 text-xs whitespace-nowrap">
                  {new Date(log.delivered_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-3 pr-4">
                  <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">{log.event_type}</code>
                </td>
                <td className="py-3 pr-4">
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      isSuccess
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    {isSuccess ? "Delivered" : "Failed"}
                  </Badge>
                </td>
                <td className="py-3 pr-4 text-gray-500 text-xs">
                  {log.response_status ?? "—"}
                </td>
                <td className="py-3 pr-4 text-gray-500 text-xs">{log.attempts}</td>
                <td className="py-3">
                  {isFailed && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-2"
                      onClick={() => retry(log.id)}
                      disabled={retrying === log.id}
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${retrying === log.id ? "animate-spin" : ""}`} />
                      Retry
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
