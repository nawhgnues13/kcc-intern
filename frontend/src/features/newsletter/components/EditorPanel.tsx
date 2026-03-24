import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Loader2, Check, Edit3, Mail, ImagePlus, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router";
import { NewsletterHeader } from "./NewsletterHeader";
import { NewsletterFooter } from "./NewsletterFooter";
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { newsletterService } from "../../../services/api/newsletterService";
import { useAuthStore } from "../../../store/useAuthStore";
import { Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Undo, Redo, Image as ImageIcon } from "lucide-react";

function renderSimpleMarkdown(line: string, index: number) {
  // Handle empty lines as spaces
  if (line.trim() === '') return <br key={index} />;

  // Headings
  if (line.startsWith('### ')) return <h3 key={index} className="text-lg font-bold mt-6 mb-2">{formatInline(line.replace('### ', ''))}</h3>;
  if (line.startsWith('## ')) return <h2 key={index} className="text-xl font-bold mt-8 mb-4">{formatInline(line.replace('## ', ''))}</h2>;
  if (line.startsWith('# ')) return <h1 key={index} className="text-3xl font-bold mt-10 mb-6">{formatInline(line.replace('# ', ''))}</h1>;

  // Unordered Lists
  if (line.startsWith('- ') || line.startsWith('* ')) {
    return <li key={index} className="ml-6 mb-1 list-disc list-outside">{formatInline(line.substring(2))}</li>;
  }

  // Blockquotes
  if (line.startsWith('> ')) {
    return <blockquote key={index} className="border-l-4 border-[#3721ED] pl-4 italic text-slate-500 my-4 bg-slate-50 p-3 rounded-r-lg">{formatInline(line.substring(2))}</blockquote>;
  }

  // Regular paragraph
  return <p key={index} className="mb-4 text-slate-600 leading-relaxed">{formatInline(line)}</p>;
}

function formatInline(text: string) {
  let html = text
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    // Inline Code
    .replace(/`(.*?)`/g, '<code class="bg-slate-100 text-pink-500 px-1.5 py-0.5 rounded text-sm">$1</code>')
    // Links (very basic)
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#3721ED] hover:underline font-medium">$1</a>');
    
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

const MenuBar = ({ editor, articleId }: { editor: Editor | null; articleId?: string }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50/50 border-b border-slate-200">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-[#3721ED]/10 text-[#3721ED]' : 'text-slate-600 hover:bg-slate-200'}`}
        title="굵게"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-[#3721ED]/10 text-[#3721ED]' : 'text-slate-600 hover:bg-slate-200'}`}
        title="기울이기"
      >
        <Italic className="w-4 h-4" />
      </button>
      
      <div className="w-px h-6 bg-slate-300 mx-1" />
      
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-[#3721ED]/10 text-[#3721ED]' : 'text-slate-600 hover:bg-slate-200'}`}
        title="제목 1"
      >
        <Heading1 className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-[#3721ED]/10 text-[#3721ED]' : 'text-slate-600 hover:bg-slate-200'}`}
        title="제목 2"
      >
        <Heading2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive('heading', { level: 3 }) ? 'bg-[#3721ED]/10 text-[#3721ED]' : 'text-slate-600 hover:bg-slate-200'}`}
        title="제목 3"
      >
        <Heading3 className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-slate-300 mx-1" />

      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-[#3721ED]/10 text-[#3721ED]' : 'text-slate-600 hover:bg-slate-200'}`}
        title="글머리 기호 목록"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive('orderedList') ? 'bg-[#3721ED]/10 text-[#3721ED]' : 'text-slate-600 hover:bg-slate-200'}`}
        title="번호 매기기 목록"
      >
        <ListOrdered className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive('blockquote') ? 'bg-[#3721ED]/10 text-[#3721ED]' : 'text-slate-600 hover:bg-slate-200'}`}
        title="인용"
      >
        <Quote className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-slate-300 mx-1" />

      <label className="p-1.5 rounded-lg transition-colors text-slate-600 hover:bg-slate-200 cursor-pointer" title="이미지 첨부">
        <ImageIcon className="w-4 h-4" />
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            
            if (articleId) {
              try {
                const res = await newsletterService.uploadAssetImage(articleId, file);
                if (res.imageUrl) {
                  editor.chain().focus().setImage({ src: res.imageUrl }).run();
                }
              } catch (err) {
                console.error("에디터 이미지 업로드 실패:", err);
                alert("이미지 업로드에 실패했습니다. 파일 용량이나 네트워크 상태를 확인해주세요.");
              }
            } else {
              // 최초 생성 시 articleId가 없는 경우 fallback으로 Base64 사용
              const reader = new FileReader();
              reader.onload = (event) => {
                const src = event.target?.result as string;
                if (src) {
                  editor.chain().focus().setImage({ src }).run();
                }
              };
              reader.readAsDataURL(file);
            }
            // Reset input so the same file can be uploaded again if needed
            e.target.value = '';
          }}
        />
      </label>

      <div className="w-px h-6 bg-slate-300 mx-1" />

      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        className="p-1.5 rounded-lg transition-colors text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
        title="실행 취소"
      >
        <Undo className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        className="p-1.5 rounded-lg transition-colors text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
        title="다시 실행"
      >
        <Redo className="w-4 h-4" />
      </button>
    </div>
  );
};

interface EditorPanelProps {
  isGenerating: boolean;
  newsletterTitle: string;
  setNewsletterTitle: (val: string) => void;
  newsletterContent: string;
  setNewsletterContent: (val: string) => void;
  heroImage: string;
  handleImageReplace: () => void;
  isEditingContent: boolean;
  setIsEditingContent: (val: boolean) => void;
  setShowEmailModal: (val: boolean) => void;
  headerFooter: string;
  articleId?: string;
  isViewMode?: boolean;
  authorUserId?: string;
}

export function EditorPanel({
  isGenerating,
  newsletterTitle,
  setNewsletterTitle,
  newsletterContent,
  setNewsletterContent,
  heroImage,
  handleImageReplace,
  isEditingContent,
  setIsEditingContent,
  setShowEmailModal,
  headerFooter,
  articleId,
  isViewMode,
  authorUserId
}: EditorPanelProps) {
  const navigate = useNavigate();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isAuthor = !authorUserId || currentUserId === authorUserId;

  // Helper to safely parse initial content
  const getInitialContent = (content: string) => {
    try {
      if (content.trim().startsWith('{')) {
        // Sanitize backend 'quote' nodes to Tiptap 'blockquote'
        let sanitized = content.replace(/"type"\s*:\s*"quote"/g, '"type":"blockquote"');
        // Sanitize backend 'strong' and 'em' marks to Tiptap 'bold' and 'italic'
        sanitized = sanitized.replace(/"type"\s*:\s*"strong"/g, '"type":"bold"');
        sanitized = sanitized.replace(/"type"\s*:\s*"em"/g, '"type":"italic"');
        return JSON.parse(sanitized);
      }
    } catch {
      // Fallback to string if not valid JSON
    }
    return content;
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-xl border border-slate-200 shadow-sm max-w-full h-auto my-4',
        },
      }),
      Placeholder.configure({
        placeholder: '본문 내용을 입력하세요...',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    ],
    content: getInitialContent(newsletterContent),
    onUpdate: ({ editor }: { editor: Editor }) => {
      // We store JSON string directly for Tiptap
      setNewsletterContent(JSON.stringify(editor.getJSON()));
    },
    // Prevent unmounting the editor instance when toggling Edit mode
    editable: isEditingContent,
  });

  // Sync editability and focus
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditingContent);
      if (isEditingContent) {
        editor.commands.focus();
      }
    }
  }, [isEditingContent, editor]);

  // Sync content if it changes externally (e.g. AI generation)
  // Only sync if the editor is NOT focused to avoid cursor jumping
  useEffect(() => {
    if (editor && !editor.isFocused) {
      const currentJson = JSON.stringify(editor.getJSON());
      if (newsletterContent !== currentJson && newsletterContent !== editor.getHTML()) {
        editor.commands.setContent(getInitialContent(newsletterContent));
      }
    }
  }, [newsletterContent, editor]);

  // Keep tiptap content synced if we regenerate via external API
  // Usually better to use useEffect, but let's just make sure when toggling from View -> Edit, editor update is aware
  // (In full React implementation, useEffect checking content diff might be needed, but this is ok for now).
  
  const handleSaveToggle = async () => {
    if (isEditingContent) {
      // Transitioning from Edit to View -> Save!
      if (articleId) {
        try {
          const contentToSave = getInitialContent(newsletterContent);
          await newsletterService.updateNewsletter(articleId, {
            title: newsletterTitle,
            bodyContent: contentToSave
          });
        } catch (error) {
          console.error("Failed to save article:", error);
          alert("저장에 실패했습니다.");
          return; // Stop toggle if failed?
        }
      }
    }
    setIsEditingContent(!isEditingContent);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F8F9FB] relative">
      <div className="flex-1 overflow-y-auto p-8 relative pb-24 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border ${isGenerating ? 'border-[#3721ED]/50 ring-4 ring-[#3721ED]/10' : 'border-slate-200/60'} min-h-[500px] overflow-hidden transition-all duration-500 relative flex flex-col`}
        >
          {isGenerating && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#3721ED] animate-spin mb-4" />
              <p className="font-medium text-slate-700">AI가 콘텐츠를 다시 생성하고 있습니다...</p>
            </div>
          )}

          {/* Action Header */}
          <div className="flex items-center justify-end gap-2 p-4 bg-white border-b border-slate-100 z-10 sticky top-0">
            {!isViewMode && (
              <button
                onClick={handleSaveToggle}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl transition-all shadow-sm border ${isEditingContent ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}
              >
                {isEditingContent ? <><Check className="w-4 h-4" /> 저장하기</> : <><Edit3 className="w-4 h-4" /> 내용 수정하기</>}
              </button>
            )}
            {!isEditingContent && isAuthor && (
              <>
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#3721ED] rounded-xl hover:bg-[#2c1ac0] transition-colors shadow-sm shadow-[#3721ED]/20"
                >
                  <Mail className="w-4 h-4" /> 이메일 보내기
                </button>
                {!isViewMode && (
                  <button
                    onClick={() => navigate('/articles')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-colors shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 작성 완료
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex-1 flex flex-col">
            {/* HEADER COMPONENT */}
            <NewsletterHeader type={headerFooter} title={newsletterTitle} />

            <div className="p-10">
              {isEditingContent ? (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">콘텐츠 제목</label>
                    <input 
                      type="text" 
                      value={newsletterTitle}
                      onChange={e => setNewsletterTitle(e.target.value)}
                      className="w-full text-2xl font-bold bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#3721ED] focus:ring-2 focus:ring-[#3721ED]/20"
                    />
                  </div>
                  <div className="flex-1 mt-2 flex flex-col min-h-0">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">본문 내용 (에디터)</label>
                    <div 
                      className="bg-white rounded-xl overflow-hidden border border-slate-200 focus-within:border-[#3721ED] focus-within:ring-2 focus-within:ring-[#3721ED]/20 transition-all flex-1 flex flex-col cursor-text"
                      onClick={() => editor?.commands.focus()}
                    >
                      <MenuBar editor={editor} articleId={articleId} />
                      <div className="flex-1 overflow-y-auto w-full p-4 prose prose-slate max-w-none text-slate-800 focus:outline-none 
                        [&_.ProseMirror]:min-h-[300px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
                      >
                        <EditorContent editor={editor} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-[760px] break-keep prose prose-slate max-w-none prose-headings:font-bold prose-headings:break-keep prose-h1:mb-8 prose-h1:text-[2.2rem] prose-h1:leading-tight prose-h2:mt-8 prose-h2:mb-4 prose-h2:text-xl prose-p:leading-relaxed prose-p:text-slate-600 prose-p:break-keep prose-li:break-keep prose-blockquote:break-keep [word-break:keep-all]">
                  <h1 className="text-left break-keep leading-tight tracking-tight [word-break:keep-all]">
                    {newsletterTitle}
                  </h1>
                  
                  {/* Removed duplicate Hero Image block per user request */}
                  {/* Rendered Text Body */}
                  <div className="markdown-content break-keep [word-break:keep-all]">
                    {/* Render the JSON document through Tiptap's HTML generator */}
                    <div dangerouslySetInnerHTML={{ __html: editor?.getHTML() || "" }} />
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER COMPONENT */}
            <NewsletterFooter type={headerFooter} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
