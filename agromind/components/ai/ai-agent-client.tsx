"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Bot, Send, User, Loader2, FileText, AlertTriangle, Calendar,
  RotateCcw, Sparkles,
} from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };
type ReportType = "weekly" | "risk" | "harvest";

const REPORT_META: Record<ReportType, { label: string; icon: React.ReactNode; description: string; color: string }> = {
  weekly:  { label: "Weekly report",     icon: <FileText className="w-4 h-4" />,      description: "Field status, actions performed and upcoming tasks", color: "bg-green-50 border-green-200 hover:bg-green-100" },
  risk:    { label: "Risk analysis",  icon: <AlertTriangle className="w-4 h-4" />, description: "Active climate risks with immediate action plan",    color: "bg-orange-50 border-orange-200 hover:bg-orange-100" },
  harvest: { label: "Harvest estimate",  icon: <Calendar className="w-4 h-4" />,      description: "Optimal harvest window, logistics and projected income", color: "bg-blue-50 border-blue-200 hover:bg-blue-100" },
};

const QUICK_QUESTIONS = [
  "What should I do this week with the cherry tree?",
  "When should I harvest Lot B (Bing)?",
  "What climate risks do I have this week?",
  "Is the caliber good for export?",
  "How many hours of irrigation do I need today?",
  "What fungicide to apply before the rain?",
];

export function AiAgentClient() {
  const [tab, setTab] = useState<"chat" | "reports">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [reportContent, setReportContent] = useState<Record<ReportType, string>>({ weekly: "", risk: "", harvest: "" });
  const [generatingReport, setGeneratingReport] = useState<ReportType | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function sendMessage(userMsg?: string) {
    const text = (userMsg ?? input).trim();
    if (!text || streaming) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Placeholder del asistente
    setMessages((p) => [...p, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok || !res.body) throw new Error("Error en la respuesta");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const current = accumulated;
        setMessages((p) => {
          const updated = [...p];
          updated[updated.length - 1] = { role: "assistant", content: current };
          return updated;
        });
      }
    } catch (e) {
      setMessages((p) => {
        const updated = [...p];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "❌ Error al conectar con el agente. Verifica tu conexión y vuelve a intentarlo.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  async function generateReport(type: ReportType) {
    if (generatingReport) return;
    setGeneratingReport(type);
    setReportContent((p) => ({ ...p, [type]: "" }));

    try {
      const res = await fetch("/api/ai/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      if (!res.ok || !res.body) throw new Error();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const current = accumulated;
        setReportContent((p) => ({ ...p, [type]: current }));
      }
    } catch {
      setReportContent((p) => ({ ...p, [type]: "❌ Error al generar el reporte. Intenta de nuevo." }));
    } finally {
      setGeneratingReport(null);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
      <TabsList className="mb-4">
        <TabsTrigger value="chat" className="flex items-center gap-1.5">
          <Bot className="w-4 h-4" /> Chat with the agronomist
        </TabsTrigger>
        <TabsTrigger value="reports" className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" /> Automatic reports
        </TabsTrigger>
      </TabsList>

      {/* ── CHAT ── */}
      <TabsContent value="chat" className="space-y-4">
        {/* Preguntas rápidas */}
        {messages.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-400 mb-3 font-medium">Frequent questions</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-200 hover:bg-green-100 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mensajes */}
        <Card className="min-h-96">
          <CardContent className="p-0">
            <div className="h-[460px] overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-3">
                  <Bot className="w-12 h-12" />
                  <p className="text-sm">Consult the agronomist about your farm</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                    msg.role === "user" ? "bg-green-600" : "bg-gray-800"
                  )}>
                    {msg.role === "user"
                      ? <User className="w-3.5 h-3.5 text-white" />
                      : <Bot className="w-3.5 h-3.5 text-white" />}
                  </div>

                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                    msg.role === "user"
                      ? "bg-green-600 text-white rounded-tr-sm"
                      : "bg-gray-100 text-gray-800 rounded-tl-sm"
                  )}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-a:text-green-600">
                        {msg.content ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        )}
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <Separator />

            {/* Input */}
            <div className="p-3 flex gap-2 items-end">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="text-gray-300 hover:text-gray-500 transition-colors p-1.5 shrink-0"
                  title="Clear conversation"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <textarea
                ref={textareaRef}
                rows={2}
                className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Question about the farm, weather, management... (Enter to send)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={streaming}
              />
              <Button
                size="sm"
                onClick={() => sendMessage()}
                disabled={!input.trim() || streaming}
                className="shrink-0"
              >
                {streaming
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── REPORTES ── */}
      <TabsContent value="reports" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.entries(REPORT_META) as [ReportType, typeof REPORT_META[ReportType]][]).map(([type, meta]) => (
            <button
              key={type}
              onClick={() => generateReport(type)}
              disabled={!!generatingReport}
              className={cn(
                "flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all",
                meta.color,
                generatingReport === type && "opacity-75 cursor-wait"
              )}
            >
              <div className="flex items-center gap-2 font-semibold text-sm text-gray-800">
                {meta.icon}
                {meta.label}
                {generatingReport === type && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto" />
                )}
              </div>
              <p className="text-xs text-gray-500">{meta.description}</p>
            </button>
          ))}
        </div>

        {/* Resultados de reportes */}
        {(["weekly", "risk", "harvest"] as ReportType[]).map((type) => {
          const content = reportContent[type];
          if (!content) return null;
          const meta = REPORT_META[type];
          return (
            <Card key={type}>
              <CardHeader className="pb-3 flex flex-row items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gray-100">{meta.icon}</div>
                <CardTitle className="text-sm font-semibold">{meta.label}</CardTitle>
                {generatingReport === type && (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-auto" />
                )}
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-a:text-green-600 prose-table:text-xs">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {!Object.values(reportContent).some(Boolean) && !generatingReport && (
          <div className="text-center py-16 text-gray-300">
            <Sparkles className="w-10 h-10 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Select a report type to generate it</p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
