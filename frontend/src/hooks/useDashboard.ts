import { useState } from "react";
import { useNavigate } from "react-router";
import { useSessionStore } from "../store/useSessionStore";
import { uploadAttachmentMock } from "../services/mock/uploadMock";
import { newsletterService } from "../services/api/newsletterService";
import { useAuthStore } from "../store/useAuthStore";

export function useDashboard() {
  const { prompt, template, headerFooter, attachments, addAttachment, updateAttachment } = useSessionStore();
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();

  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    
    try {
      // 1. Prepare data mapping
      const files = attachments
        .filter(a => a.type !== 'url' && a.file)
        .map(a => a.file as File);
      
      const urls = attachments
        .filter(a => a.type === 'url' && Boolean(a.url))
        .map(a => a.url as string);

      // 2. Combine Template and HeaderFooter into one instruction
      const templateStyle = `${template} / ${headerFooter}`;

      // UUID Validation Check
      if (!user?.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) {
        alert("로그인 세션이 초기화되었거나 형식이 맞지 않습니다. 원활한 이용을 위해 다시 로그인해 주세요.");
        setIsGenerating(false);
        navigate("/login");
        return;
      }

      // 3. Call actual api point
      const res = await newsletterService.generateNewsletter(
        {
          user_id: user.id,
          instruction: prompt,
          template_style: templateStyle,
          content_format: 'newsletter',
        },
        files,
        urls
      );

      setIsGenerating(false);
      // Backend should return articleId inside the response
      if (res.articleId) {
        navigate(`/workspace?id=${res.articleId}`);
      } else {
        // Fallback in case backend returns full item directly instead of articleId wrapper
        navigate(`/workspace?id=${(res as any).id}`);
      }
    } catch (error) {
      console.error('Generation failed:', error);
      setIsGenerating(false);
      alert('생성에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  const simulateUpload = async (fileType: "pdf" | "image", name: string, file: File) => {
    const id = addAttachment({ type: fileType, name, status: "uploading", file });
    
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
