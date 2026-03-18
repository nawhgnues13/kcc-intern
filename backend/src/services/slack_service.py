import logging
import re
from datetime import datetime

from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler

from src.config import settings
from src.models.schemas import NewsletterContent

logger = logging.getLogger(__name__)

app = AsyncApp(
    token=settings.slack_bot_token,
    signing_secret=settings.slack_signing_secret,
)

# 이메일 발송 콜백 (pipeline에서 주입)
_send_email_callback = None

def set_send_email_callback(callback):
    global _send_email_callback
    _send_email_callback = callback


def _build_newsletter_blocks(content: NewsletterContent, newsletter_id: str, newsletter_type: str = "it") -> list:
    """뉴스레터 Slack 메시지 블록 생성 (초안 프리뷰 + 발송/수정 버튼 전체)"""
    from src.storage.file_store import load_recipients, get_categories

    today = datetime.now().strftime("%Y년 %m월 %d일")
    emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]

    # 기사 프리뷰
    article_blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"{emojis[i]} *[{a.category}] {a.headline}*\n> {a.summary}",
            },
        }
        for i, a in enumerate(content.articles)
    ]

    # 발송 버튼 (전체 + 분류별)
    all_recipients = load_recipients()
    total_count = len(all_recipients)
    categories = get_categories()
    category_counts = {
        cat: len([r for r in all_recipients if r["category"] == cat])
        for cat in categories
    }

    approve_buttons = [
        {
            "type": "button",
            "text": {"type": "plain_text", "text": f"✅ 전체 발송 ({total_count}명)"},
            "style": "primary",
            "action_id": "approve_newsletter",
            "value": f"{newsletter_id}:전체",
            "confirm": {
                "title": {"type": "plain_text", "text": "전체 발송 확인"},
                "text": {"type": "plain_text", "text": f"전체 {total_count}명에게 발송할까요?"},
                "confirm": {"type": "plain_text", "text": "발송"},
                "deny": {"type": "plain_text", "text": "취소"},
            },
        },
    ]
    for cat in categories:
        count = category_counts[cat]
        approve_buttons.append({
            "type": "button",
            "text": {"type": "plain_text", "text": f"{cat} ({count}명)"},
            "action_id": f"approve_newsletter_{cat}",
            "value": f"{newsletter_id}:{cat}",
            "confirm": {
                "title": {"type": "plain_text", "text": f"{cat} 발송 확인"},
                "text": {"type": "plain_text", "text": f"{cat} {count}명에게 발송할까요?"},
                "confirm": {"type": "plain_text", "text": "발송"},
                "deny": {"type": "plain_text", "text": "취소"},
            },
        })
    approve_buttons.append({
        "type": "button",
        "text": {"type": "plain_text", "text": "❌ 발송 취소"},
        "style": "danger",
        "action_id": "reject_newsletter",
        "value": newsletter_id,
    })

    # 수정 버튼 (전체 재생성 + 기사별 재작성)
    edit_buttons = [
        {
            "type": "button",
            "text": {"type": "plain_text", "text": "🔄 전체 재생성"},
            "action_id": "regenerate_newsletter",
            "value": newsletter_id,
            "confirm": {
                "title": {"type": "plain_text", "text": "전체 재생성 확인"},
                "text": {"type": "plain_text", "text": "기사 선별부터 다시 시작합니다. 계속할까요?"},
                "confirm": {"type": "plain_text", "text": "재생성"},
                "deny": {"type": "plain_text", "text": "취소"},
            },
        },
    ]
    for i, article in enumerate(content.articles):
        edit_buttons.append({
            "type": "button",
            "text": {"type": "plain_text", "text": f"✏️ {i+1}번 재작성"},
            "action_id": f"rewrite_article_{i}",
            "value": f"{newsletter_id}:{i}",
        })

    preview_url = f"{settings.server_url}/preview/{newsletter_id}"

    return [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": {"it": "📰 이번 주 IT 뉴스레터 초안이 준비됐습니다", "auto": "🚗 이번 주 자동차 뉴스레터 초안이 준비됐습니다", "kcc": "🏢 이번 주 KCC 회사 소식이 준비됐습니다"}.get(newsletter_type, "📰 뉴스레터 초안이 준비됐습니다")},
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*발행일:* {today}\n\n{content.intro}"},
            "accessory": {
                "type": "button",
                "text": {"type": "plain_text", "text": "🌐 미리보기"},
                "url": preview_url,
                "action_id": "preview_newsletter",
            },
        },
        {"type": "divider"},
        *article_blocks,
        {"type": "divider"},
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": "*발송 대상을 선택하세요*"},
        },
        {"type": "actions", "elements": approve_buttons},
        {"type": "divider"},
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": "*내용 수정*"},
        },
        {"type": "actions", "elements": edit_buttons},
    ]


async def send_for_review(content: NewsletterContent, html: str, newsletter_id: str, newsletter_type: str = "it") -> None:
    """Slack 채널에 뉴스레터 초안 전송"""
    today = datetime.now().strftime("%Y년 %m월 %d일")
    blocks = _build_newsletter_blocks(content, newsletter_id, newsletter_type)

    # 채널 자동 가입 (public 채널인 경우)
    try:
        await app.client.conversations_join(channel=settings.slack_channel_id)
    except Exception as e:
        logger.debug(f"채널 가입 불필요 (이미 가입되었거나 private 채널): {e}")

    label = {"it": "IT 뉴스레터", "auto": "자동차 뉴스레터", "kcc": "KCC 회사 소식"}.get(newsletter_type, "뉴스레터")
    await app.client.chat_postMessage(
        channel=settings.slack_channel_id,
        text=f"📰 {label} 초안 ({today})",
        blocks=blocks,
    )
    await app.client.files_upload_v2(
        channel=settings.slack_channel_id,
        content=html,
        filename=f"newsletter_{newsletter_id}.html",
        title=f"{label} HTML 미리보기 ({newsletter_id})",
    )

    logger.info(f"Slack 전송 완료, 승인 대기 중: {newsletter_id}")


# ── 승인 핸들러 ────────────────────────────────────────────

async def _process_approve(ack, body, client):
    await ack()
    action_value = body["actions"][0]["value"]
    user = body["user"]["name"]

    if ":" in action_value:
        newsletter_id, category = action_value.split(":", 1)
    else:
        newsletter_id, category = action_value, "전체"

    from src.storage.file_store import load_recipients
    recipients = load_recipients(category)
    label = f"{category} {len(recipients)}명"
    logger.info(f"승인: {newsletter_id} → {label} by {user}")

    await client.chat_update(
        channel=body["channel"]["id"],
        ts=body["message"]["ts"],
        text=f"⏳ {label}에게 발송 중...",
        blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": f"⏳ *{user}* 님이 승인했습니다. *{label}* 에게 발송 중..."}}],
    )

    success = False
    if _send_email_callback:
        success = await _send_email_callback(newsletter_id, recipients)

    result_text = (
        f"✅ *{label}* 발송 완료! (`{newsletter_id}`)"
        if success
        else f"❌ 이메일 발송 실패. 수동으로 확인해주세요. (`{newsletter_id}`)"
    )
    await client.chat_update(
        channel=body["channel"]["id"],
        ts=body["message"]["ts"],
        text=result_text,
        blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": result_text}}],
    )


@app.action("approve_newsletter")
async def handle_approve(ack, body, client):
    await _process_approve(ack, body, client)


@app.action(re.compile(r"^approve_newsletter_.+"))
async def handle_approve_category(ack, body, client):
    await _process_approve(ack, body, client)


@app.action("reject_newsletter")
async def handle_reject(ack, body, client):
    await ack()
    newsletter_id = body["actions"][0]["value"]
    user = body["user"]["name"]
    logger.info(f"거부: {newsletter_id} by {user}")

    from src.storage.file_store import update_status, NewsletterStatus
    update_status(newsletter_id, NewsletterStatus.REJECTED)

    result_text = f"❌ *{user}* 님이 발송을 취소했습니다. (`{newsletter_id}`)"
    await client.chat_update(
        channel=body["channel"]["id"],
        ts=body["message"]["ts"],
        text=result_text,
        blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": result_text}}],
    )


# ── 재생성 / 재작성 핸들러 ────────────────────────────────

@app.action("preview_newsletter")
async def handle_preview(ack, body):
    await ack()  # URL 버튼은 ack만 하면 됨


@app.action("regenerate_newsletter")
async def handle_regenerate(ack, body, client):
    """전체 파이프라인 재실행"""
    await ack()
    user = body["user"]["name"]
    channel_id = body["channel"]["id"]
    ts = body["message"]["ts"]
    logger.info(f"전체 재생성 요청 by {user}")

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
            text="✅ 새 뉴스레터가 생성됐습니다. 위 메시지를 확인하세요.",
            blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": "✅ 새 뉴스레터가 생성됐습니다. 아래 새 메시지를 확인하세요."}}],
        )
    except Exception as e:
        logger.error(f"재생성 실패: {e}")
        await client.chat_update(
            channel=channel_id,
            ts=ts,
            text="❌ 재생성 중 오류가 발생했습니다.",
            blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": "❌ 재생성 중 오류가 발생했습니다."}}],
        )


@app.action(re.compile(r"^rewrite_article_\d+"))
async def handle_rewrite_article(ack, body, client):
    """특정 기사 본문 재작성"""
    await ack()
    action_value = body["actions"][0]["value"]   # "{newsletter_id}:{index}"
    newsletter_id, index_str = action_value.split(":", 1)
    index = int(index_str)
    user = body["user"]["name"]
    channel_id = body["channel"]["id"]
    ts = body["message"]["ts"]
    logger.info(f"{index+1}번 기사 재작성 요청 by {user}")

    await client.chat_update(
        channel=channel_id,
        ts=ts,
        text=f"✏️ {index+1}번 기사 재작성 중...",
        blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": f"✏️ *{user}* 님이 *{index+1}번 기사* 재작성을 요청했습니다. 잠시 기다려주세요..."}}],
    )

    try:
        from src.services.template_service import render
        from src.storage.file_store import load_newsletter, update_newsletter_content

        stored = load_newsletter(newsletter_id)
        original_article = stored.content.articles[index]

        # newsletter_type에 따라 에디터 선택
        if stored.newsletter_type == "auto":
            from src.agents.auto_editor import rewrite_article
        elif stored.newsletter_type == "kcc":
            from src.agents.kcc_editor import rewrite_article
        else:
            from src.agents.it_editor import rewrite_article

        # 해당 기사만 재작성
        new_article = await rewrite_article(original_article)
        stored.content.articles[index] = new_article

        # HTML 재렌더링 + 저장
        new_html = render(stored.content, stored.images, newsletter_type=stored.newsletter_type)
        update_newsletter_content(newsletter_id, stored.content, new_html)

        # Slack 메시지를 새 내용으로 업데이트
        new_blocks = _build_newsletter_blocks(stored.content, newsletter_id, stored.newsletter_type)
        await client.chat_update(
            channel=channel_id,
            ts=ts,
            text=f"✅ {index+1}번 기사 재작성 완료",
            blocks=new_blocks,
        )
        logger.info(f"{index+1}번 기사 재작성 완료: {newsletter_id}")

    except Exception as e:
        logger.error(f"재작성 실패 ({index+1}번): {e}")
        await client.chat_update(
            channel=channel_id,
            ts=ts,
            text=f"❌ {index+1}번 기사 재작성 중 오류가 발생했습니다.",
            blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": f"❌ {index+1}번 기사 재작성 중 오류가 발생했습니다."}}],
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
        text=f"🔍 *{query}* 관련 기사를 수집하여 뉴스레터를 생성하고 있습니다. 잠시 기다려주세요...",
        thread_ts=event["ts"],
    )
    channel_id = event["channel"]
    loading_ts = loading["ts"]

    try:
        from src.pipeline.it_newsletter import run_keyword_pipeline
        newsletter_id = await run_keyword_pipeline(query)

        if newsletter_id:
            result_text = f"✅ *{query}* 뉴스레터가 생성됐습니다. 위 메시지에서 확인 후 발송하세요."
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
