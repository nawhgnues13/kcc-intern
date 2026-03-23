import { useState, useRef, useEffect } from "react";
import { useSessionStore } from "../store/useSessionStore";
import { newsletterService } from "../services/api/newsletterService";

export function useChat() {
  const { prompt, template } = useSessionStore();
  
  const [messages, setMessages] = useState([
    { role: "user" as const, content: prompt || `Generate a ${template}` },
    { role: "ai" as const, content: "안녕하세요! 무엇을 도와드릴까요?" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatMode, setChatMode] = useState<"chat" | "edit">("chat");
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const handleSendMessage = async (articleId?: string, onArticleUpdated?: (article: any) => void) => {
    if (!chatInput.trim() || !articleId) return;
    
    const userMessage = chatInput;
    const currentMode = chatMode;
    
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setChatInput("");
    setIsGenerating(true);

    try {
      if (currentMode === "chat") {
        const response = await newsletterService.chatWithAssistant(articleId, { message: userMessage });
        const aiReply = response.assistantMessage?.messageText || "대화 응답을 받았습니다.";
        setMessages(prev => [...prev, { role: "ai", content: aiReply }]);
      } else {
        const response = await newsletterService.editWithAssistant(articleId, { message: userMessage });
        const aiReply = response.assistantMessage?.messageText || "본문 수정을 완료했습니다.";
        setMessages(prev => [...prev, { role: "ai", content: aiReply }]);
        
        // Sync Editor content if backend returned updated article
        if (response.article && onArticleUpdated) {
          onArticleUpdated(response.article);
        }
      }
    } catch (error) {
      console.error("AI Assistant request failed:", error);
      setMessages(prev => [...prev, { role: "ai", content: "앗, 오류가 발생했어요. 다시 시도해 주세요!" }]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Exposed specifically to simulate the "Regenerating" flow externally
  const appendUserMessage = (msg: string) => {
    setMessages(prev => [...prev, { role: "user", content: msg }]);
  };
  
  const appendAiMessage = (msg: string) => {
    setMessages(prev => [...prev, { role: "ai", content: msg }]);
  };

  return {
    messages,
    chatInput,
    setChatInput,
    chatMode,
    setChatMode,
    isGenerating,
    setIsGenerating,
    messagesEndRef,
    handleSendMessage,
    appendUserMessage,
    appendAiMessage,
    setMessages
  };
}
