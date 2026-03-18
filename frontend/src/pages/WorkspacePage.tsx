import { useState, useEffect } from "react";
import { useLocation } from "react-router";
import { useSessionStore } from "../store/useSessionStore";

import { ChatPanel } from "../features/chat/components/ChatPanel";
import { EditorPanel } from "../features/newsletter/components/EditorPanel";
import { SettingsPanel } from "../features/settings/components/SettingsPanel";
import { EmailSendModal } from "../features/newsletter/components/EmailSendModal";
import { ImageReplaceModal } from "../features/newsletter/components/ImageReplaceModal";
import { ModalLayout } from "../components/shared/ModalLayout";
import { Trash2, ExternalLink, X, FileText, Image as ImageIcon, Link2 } from "lucide-react";
import { AnimatePresence } from "motion/react";

import { useChat } from "../hooks/useChat";
import { useNewsletterEditor } from "../hooks/useNewsletterEditor";
import { useWorkspaceModals } from "../hooks/useWorkspaceModals";

export function WorkspacePage() {
  const location = useLocation();
  const { attachments, removeAttachment, template, headerFooter } = useSessionStore();
  
  const {
    messages, chatInput, setChatInput, handleSendMessage, isGenerating, setIsGenerating, messagesEndRef, appendUserMessage, appendAiMessage
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

  const onRegenerateClick = () => {
    handleRegenerate(setIsGenerating, appendUserMessage, appendAiMessage);
  };

  useEffect(() => {
    if (location.state?.article) {
      const article = location.state.article;
      setNewsletterTitle(article.title);
      setNewsletterContent(`## 원본 기사\n\n${article.excerpt}\n\n**카테고리:** ${article.category}\n**작성자:** ${article.author}\n**발행일:** ${new Date(article.publishedAt).toLocaleDateString()}\n\n---\n\n*위 기사를 바탕으로 새로운 콘텐츠를 작성해주세요.*`);
      if (article.imageUrl) {
        setHeroImage(article.imageUrl);
      }
      
      // Clear state so a refresh doesn't overwrite user edits
      window.history.replaceState({}, document.title);
    }
  }, [location.state, setNewsletterTitle, setNewsletterContent, setHeroImage]);

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-[#F8F9FB]">
      
      {/* LEFT PANEL: Chat / Prompt Conversation */}
      <ChatPanel 
        messages={messages}
        chatInput={chatInput}
        setChatInput={setChatInput}
        handleSendMessage={handleSendMessage}
        isGenerating={isGenerating}
        messagesEndRef={messagesEndRef}
      />

      {/* CENTER PANEL: Editor & Preview */}
      <EditorPanel 
        isGenerating={isGenerating}
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
      />

      {/* RIGHT PANEL: References & Settings */}
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
      />

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
                <button className="p-2 text-slate-400 hover:text-[#3721ED] hover:bg-[#3721ED]/10 rounded-xl transition-colors">
                  <ExternalLink className="w-5 h-5" />
                </button>
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
                  <div className="flex flex-col items-center gap-4">
                    <Link2 className="w-16 h-16 opacity-50" />
                    <p>웹사이트 내용 추출 미리보기</p>
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
