"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage, ChatResponse } from "@/types";
import { sendGeneralChat } from "@/lib/api";

const SUGGESTIONS = [
  "What's happening in the world today?",
  "Explain the latest AI developments",
  "Top business news this week",
  "What's trending in technology?",
  "Summarize today's global politics",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: ChatMessage = { role: "user", content: text.trim() };
      const newMessages = [...messages, userMsg].slice(-20);
      setMessages(newMessages);
      setInput("");
      setLoading(true);

      try {
        const resp: ChatResponse = await sendGeneralChat(text.trim(), messages);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: resp.answer },
        ]);
        setProvider(resp.ai_provider);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I couldn't process that. Please try again.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[90] w-14 h-14 bg-black text-white flex items-center justify-center shadow-lg hover:bg-[#333] transition-all cursor-pointer group"
          style={{ borderRadius: "28px" }}
          title="Ask AiON AI"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full border-2 border-black animate-ping opacity-20 pointer-events-none" />
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-[90] w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-4rem)] bg-white border border-[var(--color-border)] shadow-2xl flex flex-col chat-widget-panel">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-black text-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/15 flex items-center justify-center rounded-full">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
              </div>
              <div>
                <div className="text-[13px] font-bold tracking-wide">
                  AiON Assistant
                </div>
                <div className="text-[10px] text-white/60">
                  AI-powered news expert
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Clear button */}
              {messages.length > 0 && (
                <button
                  onClick={() => {
                    setMessages([]);
                    setProvider("");
                  }}
                  className="p-1.5 hover:bg-white/15 transition-colors cursor-pointer rounded"
                  title="Clear chat"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M1 3.5h12M5.5 3.5V2a1 1 0 011-1h1a1 1 0 011 1v1.5M3 3.5l.5 8a1.5 1.5 0 001.5 1.5h4a1.5 1.5 0 001.5-1.5l.5-8" />
                  </svg>
                </button>
              )}
              {/* Minimize */}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-white/15 transition-colors cursor-pointer rounded"
                title="Minimize"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M3 7h8" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          >
            {/* Welcome state */}
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center px-2">
                <div className="w-12 h-12 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] flex items-center justify-center mb-3 rounded-full">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-text-secondary)"
                    strokeWidth="1.5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                </div>
                <p className="text-[14px] font-semibold text-[var(--color-text-primary)] mb-1">
                  Ask me anything
                </p>
                <p className="text-[12px] text-[var(--color-text-tertiary)] mb-4 leading-relaxed">
                  I can help you understand world events, explain news topics,
                  and discuss current affairs.
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="suggestion-chip text-[11px] !px-3 !py-1.5"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 bg-black text-white flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 rounded-full">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  </div>
                )}
                <div
                  className={
                    msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"
                  }
                  style={{ fontSize: "13px" }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 bg-black text-white flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 rounded-full">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div className="chat-bubble-ai" style={{ fontSize: "13px" }}>
                  <div className="flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 bg-[var(--color-text-tertiary)] rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-[var(--color-text-tertiary)] rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-[var(--color-text-tertiary)] rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Follow-up suggestions */}
            {messages.length >= 2 && !loading && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {["Tell me more", "What are the implications?", "Compare perspectives"].map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="suggestion-chip text-[11px] !px-3 !py-1.5"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Provider badge + message count */}
          {messages.length > 0 && (
            <div className="flex items-center justify-between px-4 py-1 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div className="flex items-center gap-2">
                {provider && (
                  <span
                    className={`provider-badge ${provider === "anthropic" ? "claude" : "openai"}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${provider === "anthropic" ? "bg-[#d97706]" : "bg-[#10a37f]"}`}
                    />
                    {provider === "anthropic" ? "Claude" : "GPT-4o"}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[var(--color-text-tertiary)]">
                {messages.length} message{messages.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Input area */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[var(--color-border)]">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about news, events, topics..."
              disabled={loading}
              className="flex-1 text-[13px] px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-secondary)] outline-none focus:border-[var(--color-text-secondary)] transition-colors placeholder:text-[var(--color-text-tertiary)]"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className={`w-8 h-8 flex items-center justify-center flex-shrink-0 transition-colors ${
                input.trim() && !loading
                  ? "bg-black text-white hover:bg-[#333] cursor-pointer"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] cursor-not-allowed"
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L6 8M12 2l-4 10-2-4.5L1.5 4 12 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
