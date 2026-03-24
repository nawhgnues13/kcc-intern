import { useState, useMemo } from "react";
import { Copy, CheckCircle2, Globe, FileText, LayoutTemplate } from "lucide-react";

interface BlogViewerProps {
  articleId?: string;
  newsletterTitle: string;
  setNewsletterTitle: (title: string) => void;
  newsletterContent: string; // JSON string of Tiptap content
  templateStyle: string; // "blog_naver_basic" | "blog_html" | "blog_markdown"
}

export function BlogViewer({ newsletterTitle, newsletterContent, templateStyle }: BlogViewerProps) {
  const [copied, setCopied] = useState(false);

  const isRenderableImageSource = (src?: string) => {
    const value = (src || "").trim();
    if (!value) return false;
    if (value === "undefined" || value === "null") return false;

    return (
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("data:image/") ||
      value.startsWith("blob:") ||
      value.startsWith("/")
    );
  };

  // Parse Tiptap JSON to Object
  const documentObj = useMemo(() => {
    if (!newsletterContent) return { type: "doc", content: [] };
    try {
      return JSON.parse(newsletterContent);
    } catch {
      return { type: "doc", content: [] };
    }
  }, [newsletterContent]);

  // Generators for each format
  const generateMarkdown = (doc: any): string => {
    let md = `# ${newsletterTitle}\n\n`;
    if (!doc.content) return md;

    const processNode = (node: any): string => {
      if (node.type === "heading") {
        const level = node.attrs?.level || 1;
        const prefix = "#".repeat(level);
        return `${prefix} ${processTextNodes(node.content)}\n\n`;
      }
      if (node.type === "paragraph") {
        return `${processTextNodes(node.content)}\n\n`;
      }
      if (node.type === "blockquote") {
        return `> ${processTextNodes(node.content)}\n\n`;
      }
      if (node.type === "image") {
        const alt = node.attrs?.alt || "image";
        const src = node.attrs?.src || "";
        if (!isRenderableImageSource(src)) {
          return alt ? `> 이미지 설명: ${alt}\n\n` : "";
        }
        return `![${alt}](${src})\n\n`;
      }
      if (node.type === "bulletList") {
        return node.content?.map((li: any) => `- ${processTextNodes(li.content[0]?.content)}`).join("\n") + "\n\n";
      }
      if (node.type === "orderedList") {
        return node.content?.map((li: any, i: number) => `${i + 1}. ${processTextNodes(li.content[0]?.content)}`).join("\n") + "\n\n";
      }
      return "";
    };

    const processTextNodes = (nodes?: any[]): string => {
      if (!nodes) return "";
      return nodes.map(n => {
        if (n.type === "text") {
          let text = n.text || "";
          if (n.marks) {
            n.marks.forEach((mark: any) => {
              if (mark.type === "bold") text = `**${text}**`;
              if (mark.type === "italic") text = `*${text}*`;
              if (mark.type === "strike") text = `~~${text}~~`;
              if (mark.type === "link") text = `[${text}](${mark.attrs.href})`;
            });
          }
          return text;
        }
        return "";
      }).join("");
    };

    doc.content.forEach((node: any) => {
      md += processNode(node);
    });
    return md.trim();
  };

  const generateHTML = (doc: any, forNaverCopy: boolean = false): string => {
    let html = `<h1>${newsletterTitle}</h1>${forNaverCopy ? '<p><br></p>' : '\n'}`;
    if (!doc.content) return html;

    const processNode = (node: any): string => {
      const lineBreak = forNaverCopy ? '<p><br></p>' : '\n';
      
      if (node.type === "heading") {
        const level = node.attrs?.level || 1;
        return `<h${level}>${processTextNodes(node.content)}</h${level}>${lineBreak}`;
      }
      if (node.type === "paragraph") {
        // Only return if it contains actual content or we really want an empty para
        return `<p>${processTextNodes(node.content) || '<br>'}</p>${lineBreak}`;
      }
      if (node.type === "blockquote") {
        return `<blockquote>${processTextNodes(node.content)}</blockquote>${lineBreak}`;
      }
      if (node.type === "image") {
        const alt = node.attrs?.alt || "image";
        const src = node.attrs?.src || "";
        if (!isRenderableImageSource(src)) {
          return alt
            ? `<div class="my-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">이미지 설명: ${alt}</div>${lineBreak}`
            : "";
        }

        return `<figure><img src="${src}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer" /></figure>${lineBreak}`;
      }
      if (node.type === "bulletList") {
        const lis = node.content?.map((li: any) => `<li>${processTextNodes(li.content[0]?.content)}</li>`).join("\n");
        return `<ul>\n${lis}\n</ul>${lineBreak}`;
      }
      if (node.type === "orderedList") {
        const lis = node.content?.map((li: any) => `<li>${processTextNodes(li.content[0]?.content)}</li>`).join("\n");
        return `<ol>\n${lis}\n</ol>${lineBreak}`;
      }
      return "";
    };

    const processTextNodes = (nodes?: any[]): string => {
      if (!nodes) return "";
      return nodes.map(n => {
        if (n.type === "text") {
          let text = n.text || "";
          if (n.marks) {
            n.marks.forEach((mark: any) => {
              if (mark.type === "bold") text = `<strong>${text}</strong>`;
              if (mark.type === "italic") text = `<em>${text}</em>`;
              if (mark.type === "strike") text = `<del>${text}</del>`;
              if (mark.type === "link") text = `<a href="${mark.attrs.href}">${text}</a>`;
            });
          }
          return text;
        }
        return "";
      }).join("");
    };

    doc.content.forEach((node: any) => {
      html += processNode(node);
    });
    return html.trim();
  };

  const outputString = useMemo(() => {
    if (templateStyle === "blog_markdown") return generateMarkdown(documentObj);
    if (templateStyle === "blog_html") return generateHTML(documentObj);
    return ""; // For UI display, naver calls generateHTML() directly
  }, [documentObj, templateStyle, newsletterTitle]);

  const handleCopy = async () => {
    try {
      if (templateStyle === "blog_naver_basic") {
        const html = generateHTML(documentObj, true); // Create HTML with explicit <p><br></p> bridging for Naver Blog
        
        // Convert to plain text for applications that don't support HTML pasting
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html.replace(/<p><br><\/p>/g, '\n\n'); 
        const plainText = tempDiv.innerText;

        const clipboardItem = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plainText], { type: "text/plain" })
        });
        
        await navigator.clipboard.write([clipboardItem]);
      } else {
        await navigator.clipboard.writeText(outputString);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
      // Fallback for older browsers
      if (templateStyle !== "blog_naver_basic" && outputString) {
        navigator.clipboard.writeText(outputString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 z-10 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          {templateStyle === "blog_naver_basic" ? <><LayoutTemplate className="w-5 h-5 text-emerald-500" /> 네이버 블로그 레이아웃</> : 
           templateStyle === "blog_html" ? <><Globe className="w-5 h-5 text-blue-500" /> HTML 홈페이지 렌더링 화면</> : 
           <><FileText className="w-5 h-5 text-slate-500" /> Markdown 리드미 문서 화면</>}
        </h2>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 bg-[#3721ED] text-white rounded-lg text-sm font-medium hover:bg-[#2c1ac0] transition shadow-sm"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          {copied ? "복사완료" : templateStyle === "blog_naver_basic" ? "블로그 내용 복사하기" : templateStyle === "blog_html" ? "HTML 소스 복사하기" : "Markdown 소스 복사하기"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 pt-24 bg-slate-100/50">
        <div className="max-w-4xl mx-auto w-full">
          {templateStyle === "blog_naver_basic" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-12 break-keep prose prose-slate max-w-none prose-img:rounded-xl prose-img:border prose-a:text-[#03c75a] prose-headings:break-keep prose-h1:mb-10 prose-h1:text-left prose-h1:leading-tight prose-h2:break-keep prose-p:break-keep prose-li:break-keep prose-blockquote:break-keep [word-break:keep-all]">
              <div dangerouslySetInnerHTML={{ __html: generateHTML(documentObj) }} />
            </div>
          )}
          
          {templateStyle === "blog_html" && (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                  <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                  <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                </div>
                <div className="mx-auto bg-white px-3 py-1 text-xs text-slate-400 rounded-md border border-slate-200 flex-1 max-w-sm text-center font-mono">
                  homepage-preview.com
                </div>
              </div>
              <div className="p-8 md:p-12 break-keep prose prose-slate max-w-none prose-headings:font-bold prose-headings:break-keep prose-h1:text-left prose-h1:leading-tight prose-p:leading-relaxed prose-p:break-keep prose-li:break-keep prose-blockquote:break-keep prose-img:rounded-md [word-break:keep-all]">
                <div dangerouslySetInnerHTML={{ __html: generateHTML(documentObj) }} />
              </div>
            </div>
          )}

          {templateStyle === "blog_markdown" && (
            <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-3">
                <FileText className="w-5 h-5 text-slate-500" />
                <span className="font-semibold text-slate-700 font-mono text-sm">README.md</span>
              </div>
              <div className="p-8 md:p-12 break-keep prose prose-zinc max-w-none prose-a:text-blue-600 prose-headings:break-keep prose-h1:text-left prose-h1:leading-tight prose-p:break-keep prose-li:break-keep prose-blockquote:border-l-4 prose-blockquote:border-slate-300 prose-blockquote:bg-slate-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:break-keep prose-img:rounded-lg [word-break:keep-all]">
                <div dangerouslySetInnerHTML={{ __html: generateHTML(documentObj) }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
