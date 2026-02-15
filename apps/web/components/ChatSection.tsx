"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { ChatMessage } from "@/types";
import { sendChatMessage } from "@/lib/api";
import { LANGUAGES } from "./Header";

interface Props {
  articleId: number;
  storyTitle: string;
  language: string;
}

function getSuggestions(title: string): string[] {
  return [
    "Summarize the key facts in simple terms",
    "Why does this matter globally?",
    "Who are the key people and organizations involved?",
    "What's the historical context behind this?",
    "What could happen next?",
    "How are different countries reacting to this?",
  ];
}

export default function ChatSection({ articleId, storyTitle, language }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevArticleRef = useRef(articleId);

  useEffect(() => {
    if (articleId !== prevArticleRef.current) {
      setMessages([]);
      setInput("");
      setLoading(false);
      setProvider("");
      prevArticleRef.current = articleId;
    }
  }, [articleId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (question: string) => {
    if (!question.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: question.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    // If non-English language selected, instruct AI to respond in that language
    const langName = LANGUAGES.find((l) => l.code === language)?.name || "";
    const actualQuestion = language !== "en"
      ? `[Please respond in ${langName}] ${question.trim()}`
      : question.trim();

    try {
      const resp = await sendChatMessage(articleId, actualQuestion, messages);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: resp.answer,
      };
      const all = [...updated, assistantMsg];
      setMessages(all.length > 20 ? all.slice(-20) : all);
      setProvider(resp.ai_provider);
    } catch {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: "Sorry, I couldn't process that question. Please try again.",
      };
      setMessages([...updated, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const suggestions = getSuggestions(storyTitle);
  const showSuggestions = messages.length === 0 && !loading;

  const getProviderLabel = (p: string) => {
    if (p === "anthropic") return "Claude";
    if (p === "openai") return "GPT-4o";
    return "AI";
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="provider-badge claude">Claude</span>
        <span className="text-[11px] text-[var(--color-text-tertiary)]">
          Ask anything about this story
        </span>
      </div>

      {/* Conversation area */}
      <div className="min-h-[300px] max-h-[500px] overflow-y-auto mb-4">
        {/* Suggestions (shown when no messages) */}
        {showSuggestions && (
          <div>
            <p className="text-[13px] text-[var(--color-text-tertiary)] mb-3">
              Suggested questions
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="suggestion-chip text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="flex gap-3 max-w-[90%]">
                  {/* AI avatar */}
                  <div className="w-7 h-7 rounded-full bg-[var(--color-bg-inverse)] flex items-center justify-center flex-shrink-0 mt-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" opacity="0.8"/>
                      <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <div className="chat-bubble-ai">
                      {msg.content.split("\n").map((line, j) => (
                        <p key={j}>{line || "\u00A0"}</p>
                      ))}
                    </div>
                    {provider && i === messages.length - 1 && (
                      <div className="mt-1 ml-1">
                        <span className="text-[10px] text-[var(--color-text-tertiary)]">
                          {getProviderLabel(provider)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {msg.role === "user" && (
                <div className="chat-bubble-user">
                  {msg.content}
                </div>
              )}
            </motion.div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div className="w-7 h-7 rounded-full bg-[var(--color-bg-inverse)] flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" opacity="0.8"/>
                  <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="chat-bubble-ai">
                <motion.div
                  className="flex gap-1.5 py-1"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                >
                  <span className="w-2 h-2 rounded-full bg-[var(--color-text-tertiary)]" />
                  <span className="w-2 h-2 rounded-full bg-[var(--color-text-tertiary)]" />
                  <span className="w-2 h-2 rounded-full bg-[var(--color-text-tertiary)]" />
                </motion.div>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Follow-up suggestions after first exchange */}
        {messages.length >= 2 && !loading && (
          <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
            <p className="text-[11px] text-[var(--color-text-tertiary)] mb-2">Follow up</p>
            <div className="flex flex-wrap gap-1.5">
              {["Tell me more", "What are the implications?", "Compare different perspectives"].map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="suggestion-chip text-[12px]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this story..."
            disabled={loading}
            className="w-full bg-white border border-[var(--color-border)] rounded-full px-4 py-2.5 text-[14px] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-text-primary)] disabled:opacity-50 transition-colors pr-12"
          />
        </div>
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="w-10 h-10 flex items-center justify-center bg-[var(--color-bg-inverse)] text-white rounded-full disabled:opacity-30 hover:bg-[var(--color-accent-hover)] transition-colors flex-shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Message count */}
      {messages.length > 0 && (
        <div className="mt-2 text-center">
          <span className="text-[10px] text-[var(--color-text-tertiary)]">
            {messages.length} message{messages.length !== 1 ? "s" : ""}
            {provider && ` · Powered by ${getProviderLabel(provider)}`}
          </span>
        </div>
      )}
    </div>
  );
}
