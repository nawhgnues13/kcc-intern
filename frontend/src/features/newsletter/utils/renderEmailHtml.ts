import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';

function headerHtml(type: string): string {
  const today = new Date().toLocaleDateString('ko-KR');
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;

  if (type === 'KCC 모던형' || type === 'newsletter_kcc_modern') {
    return `
<tr><td style="background:#0f172a;border-top:4px solid #dc2626;padding:24px 40px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td>
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:40px;height:40px;background:#ffffff;border-radius:8px;text-align:center;vertical-align:middle;font-size:20px;font-weight:900;color:#0f172a;">K</td>
            <td style="padding-left:12px;">
              <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:2px;">KCC정보통신</div>
              <div style="color:#f87171;font-size:11px;letter-spacing:3px;margin-top:2px;">TECHNOLOGY &amp; INNOVATION</div>
            </td>
          </tr>
        </table>
      </td>
      <td align="right" style="color:#94a3b8;font-size:13px;">
        <div>Monthly Newsletter</div>
        <div style="margin-top:4px;font-family:monospace;">${today}</div>
      </td>
    </tr>
  </table>
</td></tr>`;
  }

  if (type === 'KCC 창의형' || type === 'newsletter_kcc_creative') {
    return `
<tr><td style="background:linear-gradient(to right,#0033a0,#4f46e5,#e3000f);padding:4px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr><td style="padding:24px;text-align:center;">
      <div style="font-size:26px;font-weight:900;letter-spacing:-1px;color:#0033a0;">KCC INNOVATION IT DECK</div>
      <div style="color:#64748b;font-size:12px;letter-spacing:4px;margin-top:6px;font-weight:600;">Connect The Future</div>
    </td></tr>
  </table>
</td></tr>`;
  }

  if (type === 'KCC 미니멀형' || type === 'newsletter_kcc_minimal') {
    return `
<tr><td style="border-bottom:2px solid #0f172a;padding:32px 40px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="font-size:22px;font-weight:700;color:#0f172a;font-family:Georgia,serif;">KCC Newsletter.</td>
      <td align="right" style="font-size:11px;color:#94a3b8;font-family:monospace;">KCC INFO. &amp; COMM. | ${today}</td>
    </tr>
  </table>
</td></tr>`;
  }

  if (type === 'KCC 기존형' || type === 'newsletter_kcc_classic') {
    return `
<tr><td style="background:#F5EFE6;padding:40px;text-align:center;">
  <div style="font-size:30px;font-weight:900;color:#4A3D32;">${year}년 ${month}월 KCC정보통신</div>
  <div style="font-size:20px;font-weight:700;color:#6A5D51;letter-spacing:4px;margin-top:8px;">뉴스레터</div>
</td></tr>`;
  }

  return '';
}

function footerHtml(type: string): string {
  const year = new Date().getFullYear();

  if (type === 'KCC 모던형' || type === 'newsletter_kcc_modern') {
    return `
<tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:32px 40px;text-align:center;">
  <p style="font-size:13px;color:#64748b;margin:0;">© ${year} KCC Information &amp; Communication Co., Ltd. All rights reserved.</p>
  <p style="font-size:11px;color:#94a3b8;margin:8px 0 0;">서울특별시 강서구 양천로 583 우림블루나인비즈니스센터 | 대표전화 02-2000-0000</p>
  <p style="margin:16px 0 0;">
    <a href="#" style="color:#dc2626;font-size:12px;margin:0 8px;text-decoration:none;">회사소개</a>
    <a href="#" style="color:#dc2626;font-size:12px;margin:0 8px;text-decoration:none;">개인정보처리방침</a>
  </p>
</td></tr>`;
  }

  if (type === 'KCC 창의형' || type === 'newsletter_kcc_creative') {
    return `
<tr><td style="background:#0f172a;padding:40px;text-align:center;">
  <div style="font-size:20px;font-weight:900;color:#ffffff;letter-spacing:-1px;margin-bottom:16px;">Connect The Future.</div>
  <div style="font-size:12px;color:#64748b;font-family:monospace;margin-bottom:24px;">SINCE 1967 &nbsp;|&nbsp; INNOVATION &nbsp;|&nbsp; TECHNOLOGY</div>
  <p style="font-size:11px;color:#475569;margin:0;">© KCC정보통신. 이 이메일은 KCC정보통신 구독자에게 발송됩니다.</p>
</td></tr>`;
  }

  if (type === 'KCC 미니멀형' || type === 'newsletter_kcc_minimal') {
    return `
<tr><td style="border-top:1px solid #e2e8f0;padding:32px 40px;text-align:center;">
  <div style="font-size:11px;color:#94a3b8;letter-spacing:3px;font-family:monospace;text-transform:uppercase;">
    KCC Information &amp; Communication<br>END OF TRANSMISSION
  </div>
</td></tr>`;
  }

  if (type === 'KCC 기존형' || type === 'newsletter_kcc_classic') {
    return `
<tr><td style="background:#EFE9DF;border-top:1px solid #D9CDBF;padding:24px;text-align:center;">
  <p style="font-size:13px;font-weight:600;color:#5A4D41;margin:0;">새해 복 많이 받으세요</p>
  <p style="font-size:11px;color:#8A7D71;margin:8px 0 0;">KCC정보통신과 함께 희망찬 한 해를 만들어가요.</p>
  <p style="font-size:10px;color:#A6998D;margin:16px 0 0;letter-spacing:3px;">© ${year} KCC INFO &amp; COMM.</p>
</td></tr>`;
  }

  return '';
}

function convertMarkdownText(root: Element): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }
  for (const textNode of textNodes) {
    const text = textNode.textContent ?? '';
    if (!/\*\*.*?\*\*|\*.*?\*/.test(text)) continue;
    const span = document.createElement('span');
    span.innerHTML = text
      .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:700;color:inherit;">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em style="font-style:italic;color:inherit;">$1</em>');
    textNode.parentNode?.replaceChild(span, textNode);
  }
}

function applyInlineStyles(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild!;

  convertMarkdownText(root);

  const base = 'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;';

  root.querySelectorAll('h1').forEach(el => {
    el.setAttribute('style', `${base}font-size:26px;font-weight:700;color:#111827;margin:0 0 16px;line-height:1.3;`);
  });
  root.querySelectorAll('h2').forEach(el => {
    el.setAttribute('style', `${base}font-size:21px;font-weight:700;color:#111827;margin:24px 0 12px;line-height:1.4;`);
  });
  root.querySelectorAll('h3').forEach(el => {
    el.setAttribute('style', `${base}font-size:17px;font-weight:600;color:#111827;margin:20px 0 8px;line-height:1.4;`);
  });
  root.querySelectorAll('p').forEach(el => {
    el.setAttribute('style', `${base}font-size:15px;line-height:1.75;color:#374151;margin:0 0 16px;`);
  });
  root.querySelectorAll('ul').forEach(el => {
    el.setAttribute('style', `margin:0 0 16px;padding-left:24px;`);
  });
  root.querySelectorAll('ol').forEach(el => {
    el.setAttribute('style', `margin:0 0 16px;padding-left:24px;`);
  });
  root.querySelectorAll('li').forEach(el => {
    el.setAttribute('style', `${base}font-size:15px;line-height:1.75;color:#374151;margin:0 0 6px;`);
  });
  root.querySelectorAll('blockquote').forEach(el => {
    el.setAttribute('style', `border-left:4px solid #d1d5db;padding:8px 16px;margin:0 0 16px;color:#6b7280;font-style:italic;`);
  });
  root.querySelectorAll('strong').forEach(el => {
    el.setAttribute('style', `font-weight:700;color:inherit;`);
  });
  root.querySelectorAll('em').forEach(el => {
    el.setAttribute('style', `font-style:italic;color:inherit;`);
  });
  root.querySelectorAll('code').forEach(el => {
    el.setAttribute('style', `background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:13px;color:#1f2937;`);
  });
  root.querySelectorAll('pre').forEach(el => {
    el.setAttribute('style', `background:#1e293b;color:#e2e8f0;padding:16px;border-radius:8px;margin:0 0 16px;overflow:auto;font-family:monospace;font-size:13px;`);
  });
  root.querySelectorAll('hr').forEach(el => {
    el.setAttribute('style', `border:none;border-top:1px solid #e5e7eb;margin:24px 0;`);
  });
  root.querySelectorAll('a').forEach(el => {
    el.setAttribute('style', `color:#3721ED;text-decoration:underline;`);
  });
  root.querySelectorAll('img').forEach(el => {
    el.setAttribute('style', `max-width:100%;height:auto;display:block;border-radius:8px;margin:0 0 16px;`);
  });

  return root.innerHTML;
}

export function renderEmailHtml(headerFooter: string, bodyContentJson: unknown, title: string): string {
  let bodyHtml = '';
  try {
    const json = typeof bodyContentJson === 'string' ? JSON.parse(bodyContentJson) : bodyContentJson;
    // 백엔드 저장 시 'quote' → 'blockquote', 'strong'/'em' mark 변환
    const sanitized = JSON.parse(
      JSON.stringify(json)
        .replace(/"type":"quote"/g, '"type":"blockquote"')
        .replace(/"type":"strong"/g, '"type":"bold"')
        .replace(/"type":"em"/g, '"type":"italic"')
    );
    const raw = generateHTML(sanitized, [StarterKit, Image]);
    bodyHtml = applyInlineStyles(raw);
  } catch {
    bodyHtml = '';
  }

  const header = headerHtml(headerFooter);
  const footer = footerHtml(headerFooter);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
${header}
<tr><td style="padding:40px 48px 32px;">
  <h1 style="font-size:24px;font-weight:700;margin:0 0 24px;color:#111827;">${title}</h1>
  ${bodyHtml}
</td></tr>
${footer}
</table>
</td></tr>
</table>
</body>
</html>`;
}
