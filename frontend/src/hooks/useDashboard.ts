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
  const [searchModalOpen, setSearchModalOpen] = useState(false);
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

      const urlAttachments = attachments.filter(a => a.type === 'url' && Boolean(a.url));
      const urls = urlAttachments.map(a => a.url as string);
      const urlNames = urlAttachments.map(a => a.name || a.url as string);

      // 2. Determine content format and template style
      let finalContentFormat = 'newsletter';
      let finalTemplateStyle = headerFooter;
      
      if (template === '인스타그램') {
        finalContentFormat = 'instagram';
        finalTemplateStyle = 'instagram_default';
      } else if (template === '블로그') {
        finalContentFormat = 'blog';
        finalTemplateStyle = headerFooter;
      } else {
        finalContentFormat = 'newsletter';
        finalTemplateStyle = `${template} / ${headerFooter}`;
      }

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
          template_style: finalTemplateStyle,
          content_format: finalContentFormat,
        },
        files,
        urls,
        urlNames
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

  const handleAddSearchUrls = (items: { url: string; title: string }[]) => {
    items.forEach((item) => {
      addAttachment({ type: "url", name: item.title || item.url, url: item.url, status: "completed" });
    });
  };

  return {
    urlModalOpen,
    setUrlModalOpen,
    sourceModalOpen,
    setSourceModalOpen,
    searchModalOpen,
    setSearchModalOpen,
    urlInput,
    setUrlInput,
    isGenerating,
    handleGenerate,
    simulateUpload,
    handleAddUrl,
    handleAddSearchUrls,
  };
}
