import json
import logging
from datetime import datetime
from pathlib import Path

from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler

from src.config import settings
from src.models.schemas import CuratedArticle

logger = logging.getLogger(__name__)

app = AsyncApp(
    token=settings.slack_bot_token,
    signing_secret=settings.slack_signing_secret,
)


# ── Phase 1: 기사 선택 메시지 ──────────────────────────────

def _build_curated_preview_blocks(curated: list[CuratedArticle], newsletter_id: str, newsletter_type: str, newsletter_articles=None) -> list:
    """에디터가 작성한 한국어 헤드라인·요약으로 Slack 미리보기 구성"""
    emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"]
    title_map = {
        "it": "📰 IT 뉴스레터가 준비됐습니다",
        "auto": "🚗 자동차 뉴스레터가 준비됐습니다",
        "kcc": "🏢 KCC 소식지가 준비됐습니다",
    }
    today = datetime.now().strftime("%Y년 %m월 %d일")

    article_blocks = []
    for i, a in enumerate(curated):
        if newsletter_articles and i < len(newsletter_articles):
            na = newsletter_articles[i]
            headline = na.headline
            summary = na.summary
        else:
            headline = a.title
            summary = a.description[:80]

        article_blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"{emojis[i]} *{headline}*\n{summary}",
            },
        })

    return [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": title_map.get(newsletter_type, "📰 뉴스레터 후보 기사가 준비됐습니다")},
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*발행일:* {today}\n총 *{len(curated)}건* 후보 기사 중 발송할 기사를 선택해주세요."},
        },
        {"type": "divider"},
        *article_blocks,
        {"type": "divider"},
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "미리보기"},
                    "url": f"{settings.server_url}/preview/{newsletter_id}",
                    "action_id": "preview_newsletter",
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "기사 선택 후 발송"},
                    "style": "primary",
                    "action_id": "open_article_selection",
                    "value": f"{newsletter_id}:{newsletter_type}",
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "전체 재생성"},
                    "action_id": "regenerate_newsletter",
                    "value": newsletter_id,
                    "confirm": {
                        "title": {"type": "plain_text", "text": "전체 재생성 확인"},
                        "text": {"type": "plain_text", "text": "기사 선별부터 다시 시작합니다. 계속할까요?"},
                        "confirm": {"type": "plain_text", "text": "재생성"},
                        "deny": {"type": "plain_text", "text": "취소"},
                    },
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "발송 취소"},
                    "style": "danger",
                    "action_id": "reject_newsletter",
                    "value": newsletter_id,
                    "confirm": {
                        "title": {"type": "plain_text", "text": "발송 취소"},
                        "text": {"type": "plain_text", "text": "이번 뉴스레터를 발송하지 않고 취소합니다."},
                        "confirm": {"type": "plain_text", "text": "예, 취소합니다"},
                        "deny": {"type": "plain_text", "text": "아니오"},
                        "style": "danger",
                    },
                },
            ],
        },
    ]


async def send_for_review(curated: list[CuratedArticle], newsletter_id: str, newsletter_type: str = "it") -> None:
    """Slack 채널에 후보 기사 목록 + 미리보기 링크 전송"""
    try:
        await app.client.conversations_join(channel=settings.slack_channel_id)
    except Exception as e:
        logger.debug(f"채널 가입 불필요: {e}")

    label = {"it": "IT 뉴스레터", "auto": "자동차 뉴스레터", "kcc": "KCC 소식지"}.get(newsletter_type, "뉴스레터")

    newsletter_articles = None
    try:
        from src.storage.file_store import load_newsletter
        stored = load_newsletter(newsletter_id)
        newsletter_articles = stored.content.articles
    except Exception:
        pass

    blocks = _build_curated_preview_blocks(curated, newsletter_id, newsletter_type, newsletter_articles)

    await app.client.chat_postMessage(
        channel=settings.slack_channel_id,
        text=f"📰 {label} {len(curated)}건 준비 완료 — 미리보기 확인 후 발송하세요",
        blocks=blocks,
    )
    logger.info(f"Slack 전송 완료, 검토 대기 중: {newsletter_id}")


# ── 기사 선택 모달 ──────────────────────────────────────────

@app.action("open_article_selection")
async def handle_open_selection(ack, body, client):
    """기사 선택 모달 열기"""
    await ack()
    value = body["actions"][0]["value"]
    newsletter_id, newsletter_type = value.split(":", 1)
    channel_id = body["channel"]["id"]
    message_ts = body["message"]["ts"]

    from src.storage.file_store import load_curated, load_recipients, get_categories
    data = load_curated(newsletter_id)
    articles = data["articles"]

    # 체크박스 옵션 (전부 기본 선택, Slack 150자 제한)
    def _opt_text(category: str, title: str) -> str:
        full = f"[{category}] {title}"
        return full if len(full) <= 150 else full[:147] + "..."

    checkbox_options = [
        {
            "text": {"type": "plain_text", "text": _opt_text(a["category"], a["title"])},
            "value": str(i),
        }
        for i, a in enumerate(articles)
    ]

    # 발송 대상 옵션 (카테고리별, 전체 없음)
    all_recipients = load_recipients()
    categories = get_categories()
    recipient_options = [
        {"text": {"type": "plain_text", "text": f"{cat} ({len([r for r in all_recipients if r['category'] == cat])}명)"}, "value": cat}
        for cat in categories
    ]

    # newsletter_type별 기본 수신자
    default_cats = {
        "it": ["정보통신"],
        "auto": ["오토"],
        "kcc": ["정보통신", "오토"],
    }.get(newsletter_type, categories[:1])
    recipient_defaults = [opt for opt in recipient_options if opt["value"] in default_cats]
    if not recipient_defaults:
        recipient_defaults = [recipient_options[0]]

    await client.views_open(
        trigger_id=body["trigger_id"],
        view={
            "type": "modal",
            "callback_id": "article_selection_modal",
            "private_metadata": json.dumps({
                "newsletter_id": newsletter_id,
                "newsletter_type": newsletter_type,
                "channel_id": channel_id,
                "message_ts": message_ts,
            }),
            "title": {"type": "plain_text", "text": "발송할 기사 선택"},
            "submit": {"type": "plain_text", "text": "선택 완료 → 발송"},
            "close": {"type": "plain_text", "text": "취소"},
            "blocks": [
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": "발송할 기사를 선택하세요. (최소 1건 이상)"},
                },
                {
                    "type": "input",
                    "block_id": "article_selection",
                    "label": {"type": "plain_text", "text": "기사 선택"},
                    "element": {
                        "type": "checkboxes",
                        "action_id": "selected_articles",
                        "options": checkbox_options,
                        "initial_options": checkbox_options,
                    },
                },
                {
                    "type": "input",
                    "block_id": "recipient_selection",
                    "label": {"type": "plain_text", "text": "발송 대상 (복수 선택 가능)"},
                    "element": {
                        "type": "multi_static_select",
                        "action_id": "selected_recipient",
                        "options": recipient_options,
                        "initial_options": recipient_defaults,
                    },
                },
            ],
        },
    )


@app.view("article_selection_modal")
async def handle_selection_submit(ack, body, client, view):
    """기사 선택 완료 → 이메일 발송"""
    await ack()

    meta = json.loads(view["private_metadata"])
    newsletter_id = meta["newsletter_id"]
    newsletter_type = meta["newsletter_type"]
    channel_id = meta["channel_id"]
    message_ts = meta["message_ts"]
    user = body["user"]["name"]

    values = view["state"]["values"]
    selected = values["article_selection"]["selected_articles"]["selected_options"]
    selected_indices = [int(opt["value"]) for opt in selected]

    recipient_categories = [
        opt["value"] for opt in values["recipient_selection"]["selected_recipient"]["selected_options"]
    ]

    label = {"it": "IT 뉴스레터", "auto": "자동차 뉴스레터", "kcc": "KCC 소식지"}.get(newsletter_type, "뉴스레터")
    recipient_label = " + ".join(recipient_categories)

    await client.chat_update(
        channel=channel_id,
        ts=message_ts,
        text=f"⏳ {user} 님이 {len(selected_indices)}건 선택 — {label} 발송 준비 중...",
        blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": f"⏳ *{user}* 님이 기사 *{len(selected_indices)}건* 선택 → *{recipient_label}* 발송 준비 중..."}}],
    )

    import asyncio
    asyncio.create_task(_run_phase2(
        newsletter_id=newsletter_id,
        newsletter_type=newsletter_type,
        selected_indices=selected_indices,
        recipient_categories=recipient_categories,
        channel_id=channel_id,
        message_ts=message_ts,
        user=user,
        client=client,
    ))


async def _run_phase2(
    newsletter_id: str,
    newsletter_type: str,
    selected_indices: list[int],
    recipient_categories: list[str],
    channel_id: str,
    message_ts: str,
    user: str,
    client,
) -> None:
    """선택된 기사로 이메일 발송 (전체 선택 시 기존 HTML 재활용, 일부 선택 시 재렌더링)"""
    from src.models.schemas import CuratedArticle, ImageInfo
    from src.services import email_service, image_service, template_service
    from src.storage import file_store
    from src.models.schemas import NewsletterStatus
    from src.storage.file_store import load_curated, load_newsletter, load_recipients

    label = {"it": "IT 뉴스레터", "auto": "자동차 뉴스레터", "kcc": "KCC 소식지"}.get(newsletter_type, "뉴스레터")
    subject_prefix = {"it": "IT 트렌드 위클리", "auto": "KCC오토 위클리", "kcc": "KCC 이번 달 소식"}.get(newsletter_type, "뉴스레터")

    try:
        curated_data = load_curated(newsletter_id)
        total_count = len(curated_data["articles"])

        if sorted(selected_indices) == list(range(total_count)):
            # 전체 선택 → 기존 뉴스레터 HTML 재활용
            stored = load_newsletter(newsletter_id)
            html = stored.html
            images = stored.images
            send_id = newsletter_id
        else:
            # 일부 선택 → 선택된 기사만 재렌더링
            all_curated = [CuratedArticle(**a) for a in curated_data["articles"]]
            selected_curated = [all_curated[i] for i in selected_indices]

            if newsletter_type == "auto":
                from src.agents.auto_editor import write
            elif newsletter_type == "kcc":
                from src.agents.kcc_editor import write
            else:
                from src.agents.it_editor import write
            content = await write(selected_curated)

            send_id = file_store.generate_id()
            images = []
            for i, article in enumerate(content.articles):
                if newsletter_type == "kcc":
                    img_url = await image_service.extract_content_image(article.original_link)
                    if img_url:
                        img = ImageInfo(type="og", url=img_url)
                        article.image_url = img_url
                    else:
                        try:
                            image_bytes = await image_service.generate_image(article.image_prompt or "")
                            save_path = f"data/images/{send_id}_{i}.png"
                            Path(save_path).parent.mkdir(parents=True, exist_ok=True)
                            Path(save_path).write_bytes(image_bytes)
                            img = ImageInfo(type="generated", file_path=save_path)
                            article.image_url = f"cid:article_{i}"
                        except Exception:
                            img = ImageInfo(type="none")
                else:
                    img = await image_service.get_article_image(
                        article_url=article.original_link,
                        image_prompt=article.image_prompt or "",
                        save_path=f"data/images/{send_id}_{i}.png",
                    )
                    if img.type == "og" and img.url:
                        article.image_url = img.url
                    elif img.type == "generated" and img.file_path:
                        article.image_url = f"cid:article_{i}"
                images.append(img)

            html = template_service.render(content, images, newsletter_type=newsletter_type)
            file_store.save_newsletter(send_id, content, html, images, newsletter_type=newsletter_type)

        # 이메일 발송 (복수 카테고리 합산, 이메일 중복 제거)
        seen_emails: set[str] = set()
        recipients = []
        for cat in recipient_categories:
            for r in load_recipients(cat):
                if r["email"] not in seen_emails:
                    seen_emails.add(r["email"])
                    recipients.append(r)

        today = datetime.now().strftime("%Y년 %m월 %d일")
        success = await email_service.send_email(
            html=html,
            images=images,
            subject=f"[{subject_prefix}] {today}",
            recipients=recipients,
        )

        if success:
            file_store.update_status(send_id, NewsletterStatus.SENT)
            recipient_label = f"{' + '.join(recipient_categories)} {len(recipients)}명"
            result_text = f"✅ *{user}* 님이 승인 — *{label}* *{recipient_label}* 발송 완료! (`{send_id}`)"
        else:
            result_text = f"❌ 이메일 발송 실패. 수동으로 확인해주세요. (`{send_id}`)"

    except Exception as e:
        logger.error(f"발송 실패 ({newsletter_id}): {e}")
        result_text = f"❌ 뉴스레터 발송 중 오류가 발생했습니다: {e}"

    await client.chat_update(
        channel=channel_id,
        ts=message_ts,
        text=result_text,
        blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": result_text}}],
    )


# ── 취소 / 재생성 핸들러 ──────────────────────────────────

@app.action("preview_newsletter")
async def handle_preview(ack):
    await ack()


@app.action("reject_newsletter")
async def handle_reject(ack, body, client):
    await ack()
    newsletter_id = body["actions"][0]["value"]
    user = body["user"]["name"]
    logger.info(f"발송 취소: {newsletter_id} by {user}")

    result_text = f"❌ *{user}* 님이 발송을 취소했습니다. (`{newsletter_id}`)"
    await client.chat_update(
        channel=body["channel"]["id"],
        ts=body["message"]["ts"],
        text=result_text,
        blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": result_text}}],
    )


@app.action("regenerate_newsletter")
async def handle_regenerate(ack, body, client):
    """전체 파이프라인 재실행"""
    await ack()
    user = body["user"]["name"]
    channel_id = body["channel"]["id"]
    ts = body["message"]["ts"]

    await client.chat_update(
        channel=channel_id,
        ts=ts,
        text="🔄 뉴스레터 전체 재생성 중...",
        blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": f"🔄 *{user}* 님이 재생성을 요청했습니다. 잠시 기다려주세요..."}}],
    )

    try:
        from src.pipeline.it_newsletter import run_it_newsletter_pipeline
        await run_it_newsletter_pipeline()
        await client.chat_update(
            channel=channel_id,
            ts=ts,
            text="✅ 새 후보 기사가 준비됐습니다. 아래 새 메시지를 확인하세요.",
            blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": "✅ 새 후보 기사가 준비됐습니다. 아래 새 메시지를 확인하세요."}}],
        )
    except Exception as e:
        logger.error(f"재생성 실패: {e}")
        await client.chat_update(
            channel=channel_id,
            ts=ts,
            text="❌ 재생성 중 오류가 발생했습니다.",
            blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": "❌ 재생성 중 오류가 발생했습니다."}}],
        )


# ── 멘션 핸들러 ──────────────────────────────────────────

@app.event("app_mention")
async def handle_mention(event, client, say):
    """봇 멘션 시 키워드 기반 뉴스레터 생성"""
    text = event.get("text", "")
    query = " ".join(
        word for word in text.split()
        if not word.startswith("<@")
    ).strip()

    if not query:
        await say(
            text="키워드나 주제를 함께 입력해주세요. 예: `@AI Newsletter Bot AI Agent`",
            thread_ts=event["ts"],
        )
        return

    loading = await say(
        text=f"🔍 *{query}* 관련 기사를 수집하여 후보 기사를 선별하고 있습니다. 잠시 기다려주세요...",
        thread_ts=event["ts"],
    )
    channel_id = event["channel"]
    loading_ts = loading["ts"]

    try:
        from src.pipeline.it_newsletter import run_keyword_pipeline
        curated_id = await run_keyword_pipeline(query)

        if curated_id:
            result_text = f"✅ *{query}* 후보 기사가 준비됐습니다. 위 메시지에서 기사를 선택해주세요."
        else:
            result_text = f"❌ *{query}* 관련 기사를 찾지 못했습니다. 다른 키워드로 시도해주세요."
    except Exception as e:
        logger.error(f"키워드 파이프라인 실패 ({query}): {e}")
        result_text = "❌ 뉴스레터 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."

    await client.chat_update(
        channel=channel_id,
        ts=loading_ts,
        text=result_text,
        blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": result_text}}],
    )


async def start_socket_mode():
    handler = AsyncSocketModeHandler(app, settings.slack_app_token)
    await handler.start_async()
