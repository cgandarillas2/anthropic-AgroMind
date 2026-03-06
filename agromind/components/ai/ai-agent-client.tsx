"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Bot, Send, User, Loader2, FileText, AlertTriangle, Calendar,
  RotateCcw, Sparkles, MessageSquare, Plus, Trash2, BookmarkCheck,
  ChevronLeft, Clock, BookOpen,
} from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };
type ReportType = "weekly" | "risk" | "harvest";

type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
};

type SavedReportSummary = {
  id: string;
  type: "WEEKLY" | "RISK" | "HARVEST";
  title: string;
  createdAt: string;
};

type SavedReportFull = SavedReportSummary & { content: string };

const REPORT_META: Record<ReportType, { label: string; icon: React.ReactNode; description: string; color: string }> = {
  weekly:  { label: "Weekly report",    icon: <FileText className="w-4 h-4" />,      description: "Field status, actions performed and upcoming tasks", color: "bg-green-50 border-green-200 hover:bg-green-100" },
  risk:    { label: "Risk analysis",    icon: <AlertTriangle className="w-4 h-4" />, description: "Active climate risks with immediate action plan",    color: "bg-orange-50 border-orange-200 hover:bg-orange-100" },
  harvest: { label: "Harvest estimate", icon: <Calendar className="w-4 h-4" />,      description: "Optimal harvest window, logistics and projected income", color: "bg-blue-50 border-blue-200 hover:bg-blue-100" },
};

const REPORT_TYPE_LABEL: Record<string, string> = {
  WEEKLY: "Weekly",
  RISK: "Risk",
  HARVEST: "Harvest",
};

const QUICK_QUESTIONS = [
  "What should I do this week with the cherry tree?",
  "When should I harvest Lot B (Bing)?",
  "What climate risks do I have this week?",
  "Is the caliber good for export?",
  "How many hours of irrigation do I need today?",
  "What fungicide to apply before the rain?",
];

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AiAgentClient() {
  const [tab, setTab] = useState<"chat" | "reports">("chat");

  // ── CHAT STATE ──
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [savingConversation, setSavingConversation] = useState(false);
  const [showConversationList, setShowConversationList] = useState(false);
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);

  // ── REPORTS STATE ──
  const [reportContent, setReportContent] = useState<Record<ReportType, string>>({ weekly: "", risk: "", harvest: "" });
  const [generatingReport, setGeneratingReport] = useState<ReportType | null>(null);
  const [savingReport, setSavingReport] = useState<ReportType | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReportSummary[]>([]);
  const [loadingSavedReports, setLoadingSavedReports] = useState(false);
  const [viewingReport, setViewingReport] = useState<SavedReportFull | null>(null);
  const [loadingViewReport, setLoadingViewReport] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [reportSaved, setReportSaved] = useState<Record<ReportType, boolean>>({ weekly: false, risk: false, harvest: false });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const res = await fetch("/api/ai/conversations");
      if (res.ok) setConversations(await res.json());
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  // Load saved reports list
  const loadSavedReports = useCallback(async () => {
    setLoadingSavedReports(true);
    try {
      const res = await fetch("/api/ai/reports");
      if (res.ok) setSavedReports(await res.json());
    } finally {
      setLoadingSavedReports(false);
    }
  }, []);

  // Load lists when tab becomes active
  useEffect(() => {
    if (tab === "chat" && showConversationList) loadConversations();
  }, [tab, showConversationList, loadConversations]);

  useEffect(() => {
    if (tab === "reports") loadSavedReports();
  }, [tab, loadSavedReports]);

  // ── CHAT FUNCTIONS ──

  async function sendMessage(userMsg?: string) {
    const text = (userMsg ?? input).trim();
    if (!text || streaming) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setMessages((p) => [...p, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok || !res.body) throw new Error("Error in response");

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

      // Auto-save to active conversation if one is open
      if (activeConversationId) {
        const lastAssistant = accumulated;
        await fetch(`/api/ai/conversations/${activeConversationId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "user", content: text },
              { role: "assistant", content: lastAssistant },
            ],
          }),
        });
        setConversations((prev) =>
          prev.map((c) => c.id === activeConversationId ? { ...c, updatedAt: new Date().toISOString(), _count: { messages: c._count.messages + 2 } } : c)
        );
      }
    } catch {
      setMessages((p) => {
        const updated = [...p];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "❌ Error connecting to agent. Check your connection and try again.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  async function saveConversation() {
    if (!messages.length || savingConversation || activeConversationId) return;
    setSavingConversation(true);
    try {
      const res = await fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      if (res.ok) {
        const conv = await res.json();
        setActiveConversationId(conv.id);
        setConversations((prev) => [
          { id: conv.id, title: conv.title, createdAt: conv.createdAt, updatedAt: conv.updatedAt, _count: { messages: conv.messages.length } },
          ...prev,
        ]);
      }
    } finally {
      setSavingConversation(false);
    }
  }

  async function loadConversation(id: string) {
    const res = await fetch(`/api/ai/conversations/${id}`);
    if (!res.ok) return;
    const conv = await res.json();
    const msgs: Message[] = conv.messages.map((m: { role: string; content: string }) => ({
      role: m.role === "USER" ? "user" : "assistant",
      content: m.content,
    }));
    setMessages(msgs);
    setActiveConversationId(id);
    setShowConversationList(false);
  }

  async function deleteConversation(id: string) {
    setDeletingConvId(id);
    try {
      await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } finally {
      setDeletingConvId(null);
    }
  }

  function startNewConversation() {
    setMessages([]);
    setActiveConversationId(null);
    setShowConversationList(false);
  }

  // ── REPORT FUNCTIONS ──

  async function generateReport(type: ReportType) {
    if (generatingReport) return;
    setGeneratingReport(type);
    setReportContent((p) => ({ ...p, [type]: "" }));
    setReportSaved((p) => ({ ...p, [type]: false }));

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
      setReportContent((p) => ({ ...p, [type]: "❌ Error generating report. Try again." }));
    } finally {
      setGeneratingReport(null);
    }
  }

  async function saveReport(type: ReportType) {
    const content = reportContent[type];
    if (!content || savingReport || reportSaved[type]) return;
    setSavingReport(type);
    try {
      const res = await fetch("/api/ai/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, content }),
      });
      if (res.ok) {
        const saved = await res.json();
        setReportSaved((p) => ({ ...p, [type]: true }));
        setSavedReports((prev) => [
          { id: saved.id, type: saved.type, title: saved.title, createdAt: saved.createdAt },
          ...prev,
        ]);
      }
    } finally {
      setSavingReport(null);
    }
  }

  async function viewSavedReport(id: string) {
    setLoadingViewReport(true);
    setViewingReport(null);
    try {
      const res = await fetch(`/api/ai/reports/${id}`);
      if (res.ok) setViewingReport(await res.json());
    } finally {
      setLoadingViewReport(false);
    }
  }

  async function deleteSavedReport(id: string) {
    setDeletingReportId(id);
    try {
      await fetch(`/api/ai/reports/${id}`, { method: "DELETE" });
      setSavedReports((prev) => prev.filter((r) => r.id !== id));
      if (viewingReport?.id === id) setViewingReport(null);
    } finally {
      setDeletingReportId(null);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const isChatUnsaved = messages.length > 0 && !activeConversationId;

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

      {/* ══════════════════ CHAT TAB ══════════════════ */}
      <TabsContent value="chat" className="space-y-3">

        {/* Top bar: conversation actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setShowConversationList((v) => {
                if (!v) loadConversations();
                return !v;
              });
            }}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Conversations
            {conversations.length > 0 && !showConversationList && (
              <span className="ml-1 bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                {conversations.length}
              </span>
            )}
          </button>

          <button
            onClick={startNewConversation}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>

          {isChatUnsaved && (
            <button
              onClick={saveConversation}
              disabled={savingConversation}
              className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              {savingConversation
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <BookmarkCheck className="w-3.5 h-3.5" />}
              Save conversation
            </button>
          )}

          {activeConversationId && (
            <span className="text-xs text-gray-400 flex items-center gap-1 ml-auto">
              <Clock className="w-3 h-3" />
              {conversations.find((c) => c.id === activeConversationId)?.title ?? "Saved conversation"}
            </span>
          )}
        </div>

        {/* Conversations list panel */}
        {showConversationList && (
          <Card className="border-dashed">
            <CardContent className="pt-3 pb-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500">Saved conversations</p>
                <button onClick={() => setShowConversationList(false)} className="text-gray-300 hover:text-gray-500">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {loadingConversations ? (
                <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
              ) : conversations.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">No saved conversations yet</p>
              ) : (
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {conversations.map((c) => (
                    <div
                      key={c.id}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 cursor-pointer group",
                        activeConversationId === c.id && "bg-green-50"
                      )}
                      onClick={() => loadConversation(c.id)}
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{c.title}</p>
                        <p className="text-[10px] text-gray-400">
                          {c._count.messages} messages · {formatRelativeDate(c.updatedAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                        disabled={deletingConvId === c.id}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all p-0.5"
                      >
                        {deletingConvId === c.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick questions (only when empty) */}
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

        {/* Messages */}
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
                <div key={i} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
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

            {/* Input area */}
            <div className="p-3 flex gap-2 items-end">
              {messages.length > 0 && (
                <button
                  onClick={() => { setMessages([]); setActiveConversationId(null); }}
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

      {/* ══════════════════ REPORTS TAB ══════════════════ */}
      <TabsContent value="reports" className="space-y-4">

        {/* If viewing a saved report full screen */}
        {viewingReport ? (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center gap-2">
              <button
                onClick={() => setViewingReport(null)}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <BookOpen className="w-4 h-4 text-gray-400" />
              <CardTitle className="text-sm font-semibold">{viewingReport.title}</CardTitle>
              <button
                onClick={() => deleteSavedReport(viewingReport.id)}
                disabled={deletingReportId === viewingReport.id}
                className="ml-auto text-gray-300 hover:text-red-400 transition-colors"
              >
                {deletingReportId === viewingReport.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />}
              </button>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-a:text-green-600 prose-table:text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{viewingReport.content}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Generate new reports */}
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

            {/* Generated report results */}
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
                    {/* Save button */}
                    {content && generatingReport !== type && (
                      <button
                        onClick={() => saveReport(type)}
                        disabled={!!savingReport || reportSaved[type]}
                        className={cn(
                          "ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors",
                          reportSaved[type]
                            ? "bg-green-50 border-green-200 text-green-600 cursor-default"
                            : "hover:bg-gray-50 text-gray-500 border-gray-200"
                        )}
                      >
                        {savingReport === type
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <BookmarkCheck className="w-3.5 h-3.5" />}
                        {reportSaved[type] ? "Saved" : "Save report"}
                      </button>
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

            {/* Saved reports section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Saved reports</h3>
              </div>

              {loadingSavedReports ? (
                <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
              ) : savedReports.length === 0 ? (
                <div className="text-center py-10 text-gray-300">
                  <BookOpen className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No saved reports yet</p>
                  <p className="text-xs text-gray-300 mt-1">Generate a report and click &quot;Save report&quot;</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {savedReports.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 p-3 rounded-xl border hover:bg-gray-50 cursor-pointer group transition-colors"
                      onClick={() => viewSavedReport(r.id)}
                    >
                      <div className={cn(
                        "p-2 rounded-lg shrink-0",
                        r.type === "WEEKLY" ? "bg-green-50 text-green-600" :
                        r.type === "RISK" ? "bg-orange-50 text-orange-600" :
                        "bg-blue-50 text-blue-600"
                      )}>
                        {r.type === "WEEKLY" && <FileText className="w-4 h-4" />}
                        {r.type === "RISK" && <AlertTriangle className="w-4 h-4" />}
                        {r.type === "HARVEST" && <Calendar className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{r.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {REPORT_TYPE_LABEL[r.type]} · {formatRelativeDate(r.createdAt)}
                        </p>
                      </div>
                      {loadingViewReport ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-300 shrink-0" />
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteSavedReport(r.id); }}
                          disabled={deletingReportId === r.id}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all p-0.5 shrink-0"
                        >
                          {deletingReportId === r.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!Object.values(reportContent).some(Boolean) && !generatingReport && savedReports.length === 0 && !loadingSavedReports && (
              <div className="text-center py-10 text-gray-300">
                <Sparkles className="w-10 h-10 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Select a report type to generate it</p>
              </div>
            )}
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
