"use client";

import { useRef, useEffect, useState } from "react";
import { Send, Mic, Calendar, Settings, AlertTriangle, LogOut } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { signOut } from "next-auth/react";

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    initialMessages: [
      {
        id: "welcome-msg",
        role: "assistant",
        content: "亲爱的英雄！今天经历了哪些精彩的冒险？无论是学习上的灵感、工作中的突破，还是生活里哪怕最小的闪光点，我都迫不及待想听你分享！✨",
      },
    ],
  });

  const [isGoogleHealthOk, setIsGoogleHealthOk] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetch("/api/health/google")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.ok === false && data.error === "google_auth_failed") {
          setIsGoogleHealthOk(false);
        }
      })
      .catch(console.error);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <main className="flex flex-col h-[100dvh] max-w-md mx-auto bg-gray-50 relative overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-md border-b border-gray-100 z-10 sticky top-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-sm">
            AI
          </div>
          <div>
            <h1 className="font-semibold text-gray-800 leading-tight">头号粉丝</h1>
            <p className="text-xs text-green-500 font-medium">
              {isLoading ? "✨ 正在为你思考..." : "✨ 永远在线倾听"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-gray-400 relative">
          <button className="hover:text-gray-600 transition-colors">
            <Calendar size={20} />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="hover:text-gray-600 transition-colors focus:outline-none"
            >
              <Settings size={20} />
            </button>
            
            {showSettings && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowSettings(false)}
                />
                <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-20">
                  <button
                    onClick={() => signOut({ callbackUrl: '/api/auth/signin' })}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} />
                    <span>退出登录</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Health Check Banner */}
      {!isGoogleHealthOk && (
        <div className="bg-red-50 text-red-600 border-b border-red-100 text-[13px] px-4 py-2.5 flex items-center justify-between z-10 sticky top-[57px] shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>Google 授权已过期，日历与邮箱功能受限</span>
          </div>
          <button 
            className="underline font-medium hover:text-red-700" 
            onClick={() => window.location.href = '/api/auth/signin'}
          >
            重新授权
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 scroll-smooth">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col max-w-[85%] ${
              m.role === "user" ? "items-end self-end ml-auto" : "items-start"
            }`}
          >
            <div
              className={`px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-blue-500 text-white rounded-br-sm"
                  : "bg-white text-gray-800 border border-gray-100 rounded-bl-sm"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex flex-col max-w-[85%] items-start">
            <div className="px-4 py-2.5 rounded-2xl bg-white border border-gray-100 rounded-bl-sm shadow-sm">
              <span className="flex gap-1 items-center text-gray-400 text-sm">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce [animation-delay:0.15s]">●</span>
                <span className="animate-bounce [animation-delay:0.3s]">●</span>
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-3">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 bg-gray-100 rounded-[24px] p-1.5 focus-within:ring-2 focus-within:ring-blue-100 transition-all"
        >
          <button
            type="button"
            className="p-2.5 text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0"
          >
            <Mic size={20} />
          </button>
          <textarea
            id="chat-input"
            value={input}
            onChange={handleInputChange}
            placeholder="随时记录..."
            className="flex-1 bg-transparent max-h-32 min-h-[40px] py-2.5 text-[15px] text-gray-800 placeholder-gray-400 focus:outline-none resize-none leading-tight"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
          />
          <button
            type="submit"
            id="chat-send-btn"
            disabled={!(input || "").trim() || isLoading}
            className={`p-2.5 rounded-full flex-shrink-0 transition-all ${
              (input || "").trim() && !isLoading
                ? "bg-blue-500 text-white shadow-md hover:bg-blue-600"
                : "bg-transparent text-gray-300"
            }`}
          >
            <Send size={18} className={(input || "").trim() ? "ml-0.5" : ""} />
          </button>
        </form>
      </div>
    </main>
  );
}
