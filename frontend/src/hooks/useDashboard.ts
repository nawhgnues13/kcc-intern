import { useState } from "react";
import { useNavigate } from "react-router";
import { useSessionStore } from "../store/useSessionStore";
import { uploadAttachmentMock } from "../services/mock/uploadMock";

export function useDashboard() {
  const { prompt, addAttachment, updateAttachment } = useSessionStore();
  const navigate = useNavigate();

  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      navigate("/workspace");
    }, 1500);
  };

  const simulateUpload = async (fileType: "pdf" | "image", name: string) => {
    const id = addAttachment({ type: fileType, name, status: "uploading" });
    
    await uploadAttachmentMock(fileType, name, (progress) => {
      updateAttachment(id, { progress });
    });
    
    updateAttachment(id, { status: "completed" });
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    addAttachment({ type: "url", name: urlInput, url: urlInput, status: "completed" });
    setUrlInput("");
    setUrlModalOpen(false);
  };

  return {
    urlModalOpen,
    setUrlModalOpen,
    sourceModalOpen,
    setSourceModalOpen,
    urlInput,
    setUrlInput,
    isGenerating,
    handleGenerate,
    simulateUpload,
    handleAddUrl
  };
}
