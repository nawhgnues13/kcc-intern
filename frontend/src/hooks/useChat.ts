import { useState, useRef, useEffect } from "react";
import { useSessionStore } from "../store/useSessionStore";

export function useChat() {
  const { prompt, template } = useSessionStore();
  
  const [messages, setMessages] = useState([
    { role: "user" as const, content: prompt || `Generate a ${template}` },
    { role: "ai" as const, content: "I've drafted the newsletter based on your template and attached sources. You can edit the content directly, or ask me to regenerate it." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const handleSendMessage = (onGeneratedMockCallback?: () => void) => {
    if (!chatInput.trim()) return;
    
    setMessages(prev => [...prev, { role: "user", content: chatInput }]);
    setChatInput("");
    setIsGenerating(true);

    setTimeout(() => {
      setMessages(prev => [...prev, { role: "ai", content: "I've updated the newsletter based on your feedback. How does this look?" }]);
      if (onGeneratedMockCallback) {
        onGeneratedMockCallback();
      }
      setIsGenerating(false);
    }, 1500);
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
    isGenerating,
    setIsGenerating,
    messagesEndRef,
    handleSendMessage,
    appendUserMessage,
    appendAiMessage
  };
}
