import { useState, useEffect } from "react";
import { useLocation, useSearchParams } from "react-router";
import { useSessionStore } from "../store/useSessionStore";
import { newsletterService } from "../services/api/newsletterService";

import { ChatPanel } from "../features/chat/components/ChatPanel";
import { EditorPanel } from "../features/newsletter/components/EditorPanel";
import { SettingsPanel } from "../features/settings/components/SettingsPanel";
import { EmailSendModal } from "../features/newsletter/components/EmailSendModal";
import { ImageReplaceModal } from "../features/newsletter/components/ImageReplaceModal";
import { BlogViewer } from "../features/newsletter/components/BlogViewer";
import { InstagramViewer } from "../features/newsletter/components/InstagramViewer";
import { FacebookViewer } from "../features/newsletter/components/FacebookViewer";
import { ModalLayout } from "../components/shared/ModalLayout";
import { Trash2, ExternalLink, X, FileText, Image as ImageIcon, Link2 } from "lucide-react";
import { AnimatePresence } from "motion/react";

import { useChat } from "../hooks/useChat";
import { useNewsletterEditor } from "../hooks/useNewsletterEditor";
import { useWorkspaceModals } from "../hooks/useWorkspaceModals";

export function WorkspacePage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const articleId = searchParams.get('id');
  const isViewMode = searchParams.get('mode') === 'view';

  const { 
    attachments, setAttachments, removeAttachment, 
    template, setTemplate, 
    headerFooter, setHeaderFooter 
  } = useSessionStore();
  const [contentFormat, setContentFormat] = useState<string>('newsletter');
  const [platformOutput, setPlatformOutput] = useState<any>(null);
  
  const {
    messages, setMessages, chatInput, setChatInput, chatMode, setChatMode, handleSendMessage, isGenerating, setIsGenerating, messagesEndRef, appendUserMessage, appendAiMessage
  } = useChat();

  const {
    newsletterContent, setNewsletterContent, newsletterTitle, setNewsletterTitle,
    isEditingContent, setIsEditingContent, activeTab, setActiveTab,
    tempTemplate, setTempTemplate, tempHeaderFooter, setTempHeaderFooter,
    handleRegenerate
  } = useNewsletterEditor();

  const {
    previewItem, setPreviewItem, itemToDelete, setItemToDelete,
    showEmailModal, setShowEmailModal, showImageReplaceModal, setShowImageReplaceModal,
    heroImage, setHeroImage, imagePrompt, setImagePrompt, isGeneratingImage,
    handleImageReplace, handleGenerateNewImage, handleUploadNewImage
  } = useWorkspaceModals();

  const [authorUserId, setAuthorUserId] = useState<string | null>(null);

  const onRegenerateClick = async () => {
    setTemplate(tempTemplate);
    setHeaderFooter(tempHeaderFooter);
    
    // Update local format instantly so the UI switches between EditorPanel <-> BlogViewer <-> FacebookViewer
    const newFormat = 
      tempTemplate === '인스타그램' ? 'instagram' : 
      tempTemplate === '블로그' ? 'blog' : 
      tempTemplate === '페이스북' ? 'facebook' : 
      'newsletter';
    setContentFormat(newFormat);

    // Save to DB immediately if we have an articleId
    if (articleId) {
      try {
        // Now that the backend supports these fields, we can send them to persist the design.
        await newsletterService.updateNewsletter(articleId, {
          title: newsletterTitle,
          bodyContent: typeof newsletterContent === 'string' ? JSON.parse(newsletterContent) : newsletterContent,
          contentFormat: newFormat,
          templateStyle: 
            tempTemplate === '블로그' ? tempHeaderFooter : 
            tempTemplate === '인스타그램' ? 'instagram_default' : 
            tempTemplate === '페이스북' ? 'facebook_page_basic' : 
            `${tempTemplate} / ${tempHeaderFooter}`
        });
      } catch (err) {
        console.error("Failed to save template style:", err);
      }
    }
  };

  // Handle direct API fetching logic for existing articles via ID
  useEffect(() => {
    async function loadArticleData() {
      if (!articleId) return;
      try {
        const articleData = await newsletterService.getNewsletter(articleId);
        setAuthorUserId(articleData.authorUserId ?? null);
        // Sync Editor States
        setNewsletterTitle(articleData.title || "");
        setContentFormat(articleData.contentFormat || 'newsletter');
        setPlatformOutput(articleData.platformOutput || null);

        // Only set bodyContent format (JSON normally, but assume JSON string or object)
        if (articleData.bodyContent) {
          // If the backend returns a stringified JSON schema, parse it
          const contentStr = typeof articleData.bodyContent === 'string' 
            ? articleData.bodyContent 
            : JSON.stringify(articleData.bodyContent);
          setNewsletterContent(contentStr);

          try {
            const bodyObj = typeof articleData.bodyContent === 'string' ? JSON.parse(articleData.bodyContent) : articleData.bodyContent;
            const blocks = bodyObj.content || [];
            const firstImage = blocks.find((b: any) => b.type === 'image');
            if (firstImage && firstImage.attrs?.src && !firstImage.attrs.src.includes('placehold')) {
              setHeroImage(firstImage.attrs.src);
            } else {
              setHeroImage("");
            }
          } catch (e) {
            setHeroImage("");
          }
        }

        // Sync Template and Header/Footer
        if (articleData.templateStyle) {
          if (articleData.contentFormat === 'instagram') {
            setTemplate('인스타그램');
            setHeaderFooter('instagram_default');
            setTempTemplate('인스타그램');
            setTempHeaderFooter('instagram_default');
          } else if (articleData.contentFormat === 'blog') {
            setTemplate('블로그');
            setHeaderFooter(articleData.templateStyle);
            setTempTemplate('블로그');
            setTempHeaderFooter(articleData.templateStyle);
          } else if (articleData.contentFormat === 'facebook') {
            setTemplate('페이스북');
            setHeaderFooter('facebook_page_basic');
            setTempTemplate('페이스북');
            setTempHeaderFooter('facebook_page_basic');
          } else {
            // Newsletter format: handles "Platform / Style" or just "Style" (legacy/direct ID)
            const parts = articleData.templateStyle.split(' / ');
            if (parts.length === 2) {
              setTemplate(parts[0]);
              setHeaderFooter(parts[1]);
              setTempTemplate(parts[0]);
              setTempHeaderFooter(parts[1]);
            } else {
              // If only ID exists (like "newsletter_kcc_minimal")
              setTemplate('뉴스레터');
              setHeaderFooter(articleData.templateStyle);
              setTempTemplate('뉴스레터');
              setTempHeaderFooter(articleData.templateStyle);
            }
          }
        }

        // Sync Chat Messages
        if (articleData.messages && Array.isArray(articleData.messages)) {
          const mappedMessages = articleData.messages.map((m: any) => ({
            id: m.id || Math.random().toString(),
            role: m.role === 'assistant' ? 'ai' : m.role,
            content: m.messageText || m.message_text || m.content || "",
            timestamp: m.createdAt ? new Date(m.createdAt) : new Date(),
          }));
          setMessages(mappedMessages);
        }

        // Sync Attachments / Sources
        if (articleData.sources && Array.isArray(articleData.sources)) {
          // Map backend sources to attachment store structure
          const loadedAttachments = articleData.sources.map((s: any) => ({
            id: s.id || Math.random().toString(36).substring(7),
            name: s.originalName || s.name || s.title || s.sourceUrl || "Uploaded Source",
            type: s.sourceType === 'pdf' ? 'pdf' : (s.sourceType === 'image' ? 'image' : 'url'),
            status: "completed",
            url: s.storageUrl || s.sourceUrl || ""
          }));
          setAttachments(loadedAttachments as any);
        }

      } catch (err) {
        console.error("Failed to fetch article data:", err);
      }
    }

    loadArticleData();
  }, [articleId, setTemplate, setHeaderFooter, setTempTemplate, setTempHeaderFooter, setNewsletterTitle, setContentFormat, setPlatformOutput, setNewsletterContent, setHeroImage, setMessages, setAttachments]);

  // Handle mock incoming via Route state (if fallback or testing without real generation)
  useEffect(() => {
    // Only use location state fallback if no realtime ID exists
    if (location.state?.article && !articleId) {
      const article = location.state.article;
      setNewsletterTitle(article.title);
      setNewsletterContent(`## 원본 기사\n\n${article.excerpt}\n\n**카테고리:** ${article.category}\n**작성자:** ${article.author}\n**발행일:** ${new Date(article.publishedAt).toLocaleDateString()}\n\n---\n\n*위 기사를 바탕으로 새로운 콘텐츠를 작성해주세요.*`);
      if (article.imageUrl) {
        setHeroImage(article.imageUrl);
      }
      
      // Clear state so a refresh doesn't overwrite user edits
      window.history.replaceState({}, document.title);
    }
  }, [location.state, setNewsletterTitle, setNewsletterContent, setHeroImage, articleId]);

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-[#F8F9FB]">
      
      {/* LEFT PANEL: Chat / Prompt Conversation */}
      {!isViewMode && (
        <ChatPanel 
          messages={messages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          chatMode={chatMode}
          setChatMode={setChatMode}
          handleSendMessage={() => {
            if (articleId) {
              handleSendMessage(articleId, (updatedArticle: any) => {
                if (updatedArticle.title) setNewsletterTitle(updatedArticle.title);
                if (updatedArticle.bodyContent) {
                  const contentStr = typeof updatedArticle.bodyContent === 'string' 
                    ? updatedArticle.bodyContent 
                    : JSON.stringify(updatedArticle.bodyContent);
                  setNewsletterContent(contentStr);

                  try {
                    const bodyObj = typeof updatedArticle.bodyContent === 'string' ? JSON.parse(updatedArticle.bodyContent) : updatedArticle.bodyContent;
                    const blocks = bodyObj.content || [];
                    const firstImage = blocks.find((b: any) => b.type === 'image');
                    if (firstImage && firstImage.attrs?.src && !firstImage.attrs.src.includes('placehold')) {
                      setHeroImage(firstImage.attrs.src);
                    }
                  } catch (e) {
                    // ignore
                  }
                }
              });
            }
          }}
          isGenerating={isGenerating}
          messagesEndRef={messagesEndRef}
        />
      )}

      {/* CENTER PANEL: Editor & Preview */}
      {contentFormat === 'instagram' ? (
        <InstagramViewer
          platformOutput={platformOutput}
          fallbackContent={newsletterContent}
        />
      ) : contentFormat === 'facebook' ? (
        <FacebookViewer
          platformOutput={platformOutput}
          fallbackContent={newsletterContent}
        />
      ) : contentFormat === 'blog' ? (
        <BlogViewer
          articleId={articleId || undefined}
          newsletterTitle={newsletterTitle}
          setNewsletterTitle={setNewsletterTitle}
          newsletterContent={newsletterContent}
          templateStyle={headerFooter}
        />
      ) : (
        <EditorPanel
          isGenerating={isGenerating && chatMode === 'edit'}
          newsletterTitle={newsletterTitle}
          setNewsletterTitle={setNewsletterTitle}
          newsletterContent={newsletterContent}
          setNewsletterContent={setNewsletterContent}
          heroImage={heroImage}
          handleImageReplace={handleImageReplace}
          isEditingContent={isEditingContent}
          setIsEditingContent={setIsEditingContent}
          setShowEmailModal={setShowEmailModal}
          headerFooter={headerFooter}
          articleId={articleId || undefined}
          isViewMode={isViewMode}
          authorUserId={authorUserId ?? undefined}
        />
      )}

      {/* RIGHT PANEL: References & Settings */}
      {!isViewMode && (
        <SettingsPanel 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          attachments={attachments}
          setItemToDelete={setItemToDelete}
          setPreviewItem={setPreviewItem}
          tempTemplate={tempTemplate}
          setTempTemplate={setTempTemplate}
          tempHeaderFooter={tempHeaderFooter}
          setTempHeaderFooter={setTempHeaderFooter}
          template={template}
          headerFooter={headerFooter}
          handleRegenerate={onRegenerateClick}
          isFixedTemplate={!!articleId}
        />
      )}

      {/* MODALS */}
      {/* Preview Modal */}
      <ModalLayout isOpen={!!previewItem} onClose={() => setPreviewItem(null)} maxWidthClass="max-w-4xl">
        {previewItem && (
          <div className="flex flex-col h-[80vh] overflow-hidden bg-white">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    previewItem.type === 'pdf' ? 'bg-rose-50 text-rose-500' : 
                    previewItem.type === 'image' ? 'bg-blue-50 text-blue-500' : 'bg-emerald-50 text-emerald-500'
                  }`}>
                    {previewItem.type === 'pdf' && <FileText className="w-4 h-4" />}
                    {previewItem.type === 'image' && <ImageIcon className="w-4 h-4" />}
                    {previewItem.type === 'url' && <Link2 className="w-4 h-4" />}
                </div>
                <h3 className="text-lg font-semibold text-slate-800">{previewItem.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                {previewItem.url && (
                  <a href={previewItem.url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-[#3721ED] hover:bg-[#3721ED]/10 rounded-xl transition-colors">
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
                <button onClick={() => setPreviewItem(null)} className="p-2 text-slate-400 hover:bg-slate-200/50 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 p-8 flex items-center justify-center">
              <div className="bg-white w-full h-full max-w-2xl rounded-xl shadow-sm border border-slate-200/60 flex items-center justify-center text-slate-400">
                {previewItem.type === 'image' ? (
                  <div className="flex flex-col items-center gap-4">
                    <ImageIcon className="w-16 h-16 opacity-50" />
                    <p>이미지 미리보기</p>
                  </div>
                ) : previewItem.type === 'pdf' ? (
                  <div className="flex flex-col items-center gap-4">
                    <FileText className="w-16 h-16 opacity-50" />
                    <p>문서 내용 분석 중...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-6 p-8 w-full max-w-lg">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
                      <Link2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-slate-700 font-medium">{previewItem.name}</p>
                      {previewItem.url && (
                        <p className="text-xs text-slate-400 break-all">{previewItem.url}</p>
                      )}
                    </div>
                    {previewItem.url && (
                      <a
                        href={previewItem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors text-sm shadow-sm"
                      >
                        <ExternalLink className="w-4 h-4" />
                        새 탭에서 열기
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </ModalLayout>

      {/* Delete Confirmation Modal */}
      <ModalLayout isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} maxWidthClass="max-w-sm">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4 text-rose-500">
            <Trash2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">파일 삭제</h3>
          <p className="text-slate-500 text-sm mb-6">
            이 파일을 삭제하시겠습니까? 삭제하면 AI가 콘텐츠 생성 시 참고하지 않습니다.
          </p>
          <div className="flex justify-end gap-3">
            <button 
              onClick={() => setItemToDelete(null)} 
              className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors text-sm"
            >
              취소
            </button>
            <button 
              onClick={() => {
                if(itemToDelete) removeAttachment(itemToDelete);
                setItemToDelete(null);
              }}
              className="px-4 py-2 bg-rose-500 text-white font-medium rounded-xl hover:bg-rose-600 transition-colors shadow-sm shadow-rose-500/20 text-sm"
            >
              삭제
            </button>
          </div>
        </div>
      </ModalLayout>

      <EmailSendModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        title={newsletterTitle}
        articleId={articleId ?? undefined}
        headerFooter={headerFooter}
        bodyContent={newsletterContent}
      />

      <ImageReplaceModal 
        isOpen={showImageReplaceModal}
        onClose={() => setShowImageReplaceModal(false)}
        isGeneratingImage={isGeneratingImage}
        imagePrompt={imagePrompt}
        onPromptChange={setImagePrompt}
        onGenerateClick={handleGenerateNewImage}
        onUploadClick={handleUploadNewImage}
      />

    </div>
  );
}
