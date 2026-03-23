import { RefObject } from "react";
import { motion } from "motion/react";
import { Sparkles, Send } from "lucide-react";
import { Message } from "../../../types/message";

interface ChatPanelProps {
  messages: Message[];
  chatInput: string;
  setChatInput: (val: string) => void;
  chatMode: "chat" | "edit";
  setChatMode: (val: "chat" | "edit") => void;
  handleSendMessage: () => void;
  isGenerating: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export function ChatPanel({
  messages,
  chatInput,
  setChatInput,
  chatMode,
  setChatMode,
  handleSendMessage,
  isGenerating,
  messagesEndRef
}: ChatPanelProps) {
  return (
    <div className="w-80 bg-white border-r border-slate-200 flex flex-col z-10 shrink-0 shadow-sm shadow-slate-200/50 relative">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur-md">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#3721ED]" />
          AI 어시스턴트
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {messages.map((msg, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={idx} 
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${
              msg.role === "user" 
                ? "bg-[#3721ED] text-white rounded-br-sm shadow-[#3721ED]/20" 
                : "bg-slate-50 text-slate-700 rounded-bl-sm border border-slate-100"
            }`}>
              {msg.content}
            </div>
          </motion.div>
        ))}
        {isGenerating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-slate-50 rounded-2xl rounded-bl-sm p-4 border border-slate-100 flex gap-2 items-center">
              <span className="w-2 h-2 rounded-full bg-[#3721ED] animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-[#3721ED] animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-[#3721ED] animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-100 relative">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setChatMode("chat")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              chatMode === "chat" ? "bg-[#3721ED] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            대화하기
          </button>
          <button
            onClick={() => setChatMode("edit")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              chatMode === "edit" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            본문 수정 요청
          </button>
        </div>

        <div className="relative flex items-center bg-slate-50 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-[#3721ED]/20 focus-within:border-[#3721ED]/50 transition-all">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
            placeholder={chatMode === "chat" ? "AI에게 무엇이든 물어보세요..." : "수정하고 싶은 내용을 입력하세요..."}
            className="w-full bg-transparent border-none focus:ring-0 resize-none py-3 pl-4 pr-12 text-sm text-slate-700 placeholder-slate-400 max-h-32 min-h-[44px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            rows={1}
          />
          <button 
            onClick={handleSendMessage}
            disabled={!chatInput.trim() || isGenerating}
            className="absolute right-2 bottom-2 p-1.5 bg-[#3721ED] text-white rounded-lg shadow-sm shadow-[#3721ED]/30 hover:bg-[#2c1ac0] disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
