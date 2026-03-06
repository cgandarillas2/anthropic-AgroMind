"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { CheckCheck, CheckCircle, Clock, Filter } from "lucide-react";
import type { Alert } from "@prisma/client";
import { ALERT_TYPE_LABELS } from "@/types";

const SEVERITY_STYLES = {
  CRITICAL: { card: "border-red-200",    badge: "bg-red-100 text-red-700",    dot: "bg-red-500"    },
  WARNING:  { card: "border-yellow-200", badge: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-500" },
  INFO:     { card: "border-blue-200",   badge: "bg-blue-100 text-blue-700",  dot: "bg-blue-500"   },
} as const;

type Filter = "all" | "unread" | "resolved";

interface Props {
  alerts: Alert[];
  farmId: string;
}

export function AlertsClient({ alerts: initialAlerts, farmId }: Props) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [filter, setFilter] = useState<Filter>("all");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = alerts.filter((a) => {
    if (filter === "unread") return !a.isRead && !a.isResolved;
    if (filter === "resolved") return a.isResolved;
    return !a.isResolved;
  });

  async function markRead(id: string) {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isRead: true }),
    });
  }

  async function markResolved(id: string) {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isResolved: true, isRead: true } : a))
    );
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isResolved: true, isRead: true }),
    });
  }

  async function markAllRead() {
    startTransition(async () => {
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
      await fetch("/api/alerts", { method: "PUT" });
      router.refresh();
    });
  }

  const unreadCount = alerts.filter((a) => !a.isRead && !a.isResolved).length;

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {(["all", "unread", "resolved"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                filter === f
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {f === "all" ? "Active" : f === "unread" ? "Unread" : "Resolved"}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={isPending}
            className="text-xs"
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
            Mark all as read
          </Button>
        )}
      </div>

      <Separator />

      {/* Alert list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No alerts in this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => {
            const styles = SEVERITY_STYLES[alert.severity];
            return (
              <div
                key={alert.id}
                className={cn(
                  "rounded-lg border p-4 transition-opacity",
                  styles.card,
                  !alert.isRead && !alert.isResolved ? "bg-white" : "bg-gray-50 opacity-75"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Indicator dot */}
                  <div className="mt-1.5 shrink-0">
                    {!alert.isRead && !alert.isResolved ? (
                      <div className={cn("w-2 h-2 rounded-full", styles.dot)} />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-gray-200" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900">
                          {alert.title}
                        </span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", styles.badge)}>
                          {alert.severity.toLowerCase()}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {ALERT_TYPE_LABELS[alert.type]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                        <Clock className="w-3 h-3" />
                        {format(alert.createdAt, "d MMM, HH:mm", { locale: enUS })}
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mt-1">{alert.description}</p>

                    {alert.recommendation && (
                      <div className="mt-2 text-xs bg-white/80 border border-gray-200 rounded-md px-3 py-2">
                        <span className="font-medium text-gray-500">Recommended action: </span>
                        <span className="text-gray-700">{alert.recommendation}</span>
                      </div>
                    )}

                    {alert.triggerValue && alert.triggerMetric && (
                      <div className="mt-2 text-xs text-gray-400">
                        Trigger value: {alert.triggerValue} ({alert.triggerMetric.replace(/_/g, " ")})
                      </div>
                    )}

                    {/* Actions */}
                    {!alert.isResolved && (
                      <div className="flex gap-2 mt-3">
                        {!alert.isRead && (
                          <button
                            onClick={() => markRead(alert.id)}
                            className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
                          >
                            Mark as read
                          </button>
                        )}
                        <button
                          onClick={() => markResolved(alert.id)}
                          className="text-xs text-green-600 hover:text-green-700 underline underline-offset-2"
                        >
                          Mark as resolved
                        </button>
                      </div>
                    )}

                    {alert.isResolved && alert.resolvedAt && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                        <CheckCircle className="w-3 h-3" />
                        Resolved on {format(alert.resolvedAt, "d MMM", { locale: enUS })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
