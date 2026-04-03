export type WorkspaceTemplate =
  | "newsletter"
  | "blog"
  | "instagram"
  | "facebook"
  | "kakao";

export interface TemplateOption {
  label: string;
  value: WorkspaceTemplate;
}

export interface TemplateStyleOption {
  label: string;
  value: string;
}

export const TEMPLATE_OPTIONS: TemplateOption[] = [
  { value: "newsletter", label: "뉴스레터" },
  { value: "instagram", label: "인스타그램" },
  { value: "blog", label: "블로그" },
  { value: "facebook", label: "페이스북" },
  { value: "kakao", label: "카카오톡" },
];

export const NEWSLETTER_STYLE_OPTIONS: TemplateStyleOption[] = [
  { value: "newsletter_kcc_modern", label: "KCC 모던형" },
  { value: "newsletter_kcc_creative", label: "KCC 창의형" },
  { value: "newsletter_kcc_minimal", label: "KCC 미니멀형" },
  { value: "newsletter_kcc_classic", label: "KCC 클래식형" },
];

export const BLOG_STYLE_OPTIONS: TemplateStyleOption[] = [
  { value: "blog_naver_basic", label: "기본형 네이버" },
  { value: "blog_html", label: "HTML형" },
  { value: "blog_markdown", label: "Markdown형" },
];

export function getTemplateLabel(template: string): string {
  return TEMPLATE_OPTIONS.find((option) => option.value === template)?.label || template;
}

export function getContentFormatLabel(format?: string | null): string {
  switch ((format || "").toLowerCase()) {
    case "newsletter":
      return "뉴스레터";
    case "blog":
      return "블로그";
    case "instagram":
      return "인스타그램";
    case "facebook":
      return "페이스북";
    case "kakao":
      return "카카오톡";
    default:
      return format || "문서";
  }
}

export function getContentFormatGradient(format?: string | null): string {
  switch ((format || "").toLowerCase()) {
    case "newsletter":
      return "from-blue-500 to-cyan-500";
    case "blog":
      return "from-emerald-500 to-teal-400";
    case "instagram":
      return "from-pink-500 to-orange-400";
    case "facebook":
      return "from-blue-700 to-sky-500";
    case "kakao":
      return "from-yellow-300 to-amber-400";
    default:
      return "from-slate-500 to-slate-400";
  }
}

export function getContentFormatBadgeClass(format?: string | null): string {
  switch ((format || "").toLowerCase()) {
    case "instagram":
      return "border-pink-400 bg-pink-500 text-white";
    case "facebook":
      return "border-blue-600 bg-blue-600 text-white";
    case "kakao":
      return "border-amber-400 bg-amber-400 text-slate-900";
    case "blog":
      return "border-emerald-500 bg-emerald-500 text-white";
    case "newsletter":
      return "border-[#3721ED] bg-[#3721ED] text-white";
    default:
      return "border-slate-300 bg-slate-700 text-white";
  }
}

export function shouldShowStyleSelector(template: WorkspaceTemplate): boolean {
  return template === "newsletter" || template === "blog";
}

export function getStyleOptionsForTemplate(template: WorkspaceTemplate): TemplateStyleOption[] {
  return template === "blog" ? BLOG_STYLE_OPTIONS : NEWSLETTER_STYLE_OPTIONS;
}

export function ensureHeaderFooterForTemplate(
  template: WorkspaceTemplate,
  currentValue: string,
): string {
  if (template === "blog") {
    return BLOG_STYLE_OPTIONS.some((option) => option.value === currentValue)
      ? currentValue
      : "blog_naver_basic";
  }

  if (template === "newsletter") {
    return NEWSLETTER_STYLE_OPTIONS.some((option) => option.value === currentValue)
      ? currentValue
      : "newsletter_kcc_modern";
  }

  if (template === "instagram") {
    return "instagram_default";
  }

  if (template === "facebook") {
    return "facebook_page_basic";
  }

  return "kakao_channel_basic";
}

export function getTemplateStyleForSelection(
  template: WorkspaceTemplate,
  headerFooter: string,
): string {
  if (template === "instagram") {
    return "instagram_default";
  }
  if (template === "facebook") {
    return "facebook_page_basic";
  }
  if (template === "kakao") {
    return "kakao_channel_basic";
  }
  return headerFooter;
}

export function getContentFormatFromTemplate(template: WorkspaceTemplate): string {
  return template;
}

export function getTemplateSelectionFromArticle(
  contentFormat?: string | null,
  templateStyle?: string | null,
): { template: WorkspaceTemplate; headerFooter: string } {
  const normalizedFormat = (contentFormat || "newsletter").toLowerCase();

  if (normalizedFormat === "instagram") {
    return { template: "instagram", headerFooter: "instagram_default" };
  }

  if (normalizedFormat === "blog") {
    return {
      template: "blog",
      headerFooter: templateStyle || "blog_naver_basic",
    };
  }

  if (normalizedFormat === "facebook") {
    return {
      template: "facebook",
      headerFooter: "facebook_page_basic",
    };
  }

  if (normalizedFormat === "kakao") {
    return {
      template: "kakao",
      headerFooter: "kakao_channel_basic",
    };
  }

  return {
    template: "newsletter",
    headerFooter: templateStyle || "newsletter_kcc_modern",
  };
}
