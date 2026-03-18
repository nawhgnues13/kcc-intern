# AI 뉴스레터 자동화

뉴스를 자동으로 수집하고, AI가 선별·작성하여 Slack 검토를 거친 뒤 이메일로 발송하는 자동화 서비스입니다.

---

## 뉴스레터 종류

| 종류 | 발행 | 대상 | 수집 소스 |
|------|------|------|-----------|
| **KCC 회사 소식** | 매달 첫 평일 오전 9시 | 전 임직원 | KCC 공식 블로그 |
| **IT 트렌드** | 매주 화요일 오전 9시 | KCC정보통신 | Ars Technica, MIT TR, Hacker News, InfoQ, Dev.to, The Verge, TechCrunch |
| **수입자동차** | 매주 목요일 오전 9시 | KCC오토그룹 | 오토데일리, 모터그래프, 헤럴드경제, Car and Driver, Motor Trend |

---

## 동작 흐름

```
[RSS/블로그 수집] → [AI 선별] → [AI 본문 작성] → [이미지 처리] → [HTML 생성] → [Slack 검토] → [승인 시 이메일 발송]
```

1. RSS 소스에서 최근 7일 기사를 병렬 수집
2. Gemini AI가 3건(KCC는 최대 4건)을 선별하고 선정 이유 반환
3. Gemini AI가 선별된 기사를 뉴스레터 형식으로 한국어 작성
4. 원문 이미지 추출 시도 → 없으면 Gemini로 이미지 생성
5. Jinja2 템플릿으로 HTML 이메일 렌더링
6. Slack 채널에 프리뷰 + 승인/거부 버튼 전송
7. 담당자가 승인하면 Gmail SMTP로 이메일 발송

**Slack 멘션 트리거**: `@봇이름 키워드` 로 멘션하면 키워드를 자동 분류(IT/자동차/회사소식)하여 임시 뉴스레터 생성

---

## 프로젝트 구조

```
newsletter/
├── .env                        # 환경 변수 (git에 올리지 않음)
├── .env.example                # 환경 변수 템플릿
├── requirements.txt
├── src/
│   ├── config.py               # 환경 변수 (pydantic-settings)
│   ├── main.py                 # FastAPI 앱 + 스케줄러 + Slack Socket Mode
│   ├── agents/
│   │   ├── it_scout.py         # IT 뉴스 수집 (RSS 7개 소스)
│   │   ├── it_curator.py       # IT 기사 선별 (Gemini AI)
│   │   ├── it_editor.py        # IT 뉴스레터 본문 작성 (Gemini AI)
│   │   ├── auto_scout.py       # 자동차 뉴스 수집 (RSS 5개 소스)
│   │   ├── auto_curator.py     # 자동차 기사 선별 (Gemini AI)
│   │   ├── auto_editor.py      # 자동차 뉴스레터 본문 작성 (Gemini AI)
│   │   ├── kcc_scout.py        # KCC 블로그 수집 (RSS)
│   │   ├── kcc_curator.py      # KCC 기사 선별 (최대 4건 초과 시)
│   │   ├── kcc_editor.py       # KCC 소식지 본문 작성 (Gemini AI)
│   │   └── keyword_scout.py    # 키워드 검색 수집 + 자동 분류 (Gemini Search)
│   ├── pipeline/
│   │   ├── it_newsletter.py    # IT 파이프라인 + 키워드 파이프라인
│   │   ├── auto_newsletter.py  # 자동차 파이프라인
│   │   └── kcc_newsletter.py   # KCC 소식지 파이프라인
│   ├── services/
│   │   ├── image_service.py    # 이미지 처리 (OG/본문 추출 + Gemini 생성)
│   │   ├── template_service.py # HTML 렌더링 (Jinja2)
│   │   ├── email_service.py    # Gmail SMTP 발송 (CID 인라인 첨부)
│   │   └── slack_service.py    # Slack Bot (전송 + 버튼 핸들링)
│   ├── storage/
│   │   └── file_store.py       # JSON 파일 기반 상태 저장
│   └── models/
│       └── schemas.py          # Pydantic 데이터 모델
├── templates/
│   └── newsletter.html         # 이메일 HTML 템플릿 (Jinja2)
└── data/                       # 런타임 데이터 (자동 생성, git 제외)
    ├── collected/              # 수집된 원본 기사 (날짜별 JSON)
    ├── newsletters/            # 생성된 뉴스레터 (ID별 JSON)
    └── images/                 # 생성된 이미지 (PNG)
```

---

## 실행 방법

### 1. 패키지 설치

```bash
pip install -r requirements.txt
```

Windows에서 timezone 오류가 발생하면:

```bash
pip install tzdata
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
# .env 파일을 열어 실제 값 입력
```

### 3. 서버 실행

```bash
uvicorn src.main:app --reload --port 8000
```

서버가 뜨면:
- Slack Socket Mode 연결 (버튼 인터랙션 수신 대기)
- APScheduler로 3개 파이프라인 스케줄 등록

### 4. 수동 실행

```bash
# IT 뉴스레터
curl -X POST http://localhost:8000/trigger/it

# 자동차 뉴스레터
curl -X POST http://localhost:8000/trigger/auto

# KCC 회사 소식
curl -X POST http://localhost:8000/trigger/kcc
```

---

## 환경 변수 설명 (`.env`)

| 변수명 | 필수 | 설명 |
|--------|------|------|
| `GEMINI_API_KEY` | ✅ | Google AI Studio에서 발급. 기사 선별·작성·이미지 생성에 사용 |
| `SLACK_BOT_TOKEN` | ✅ | Slack App의 Bot User OAuth Token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | ✅ | Slack App의 Signing Secret |
| `SLACK_APP_TOKEN` | ✅ | Socket Mode용 App-Level Token (`xapp-...`) |
| `SLACK_CHANNEL_ID` | ✅ | 뉴스레터 검토 채널 ID (`C`로 시작) |
| `GMAIL_USER` | ✅ | 발신 Gmail 주소 (발신자 표시 주소로도 사용) |
| `GMAIL_APP_PASSWORD` | ✅ | Gmail 앱 비밀번호 (2단계 인증 후 발급, 공백 없이 16자리) |
| `EMAIL_TO` | ✅ | 기본 수신자 이메일 (Slack에서 수신자 미지정 시 사용) |
| `SERVER_URL` | - | 미리보기 이미지 URL 생성용. 기본값: `http://localhost:8000` |

> 발행 스케줄은 코드에 고정되어 있습니다 (`src/main.py`). 변경이 필요하면 해당 파일의 `CronTrigger` 설정을 수정하세요.

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/trigger/kcc` | KCC 소식지 파이프라인 수동 실행 |
| `POST` | `/trigger/it` | IT 뉴스레터 파이프라인 수동 실행 |
| `POST` | `/trigger/auto` | 자동차 뉴스레터 파이프라인 수동 실행 |
| `GET` | `/preview/{id}` | 뉴스레터 HTML 미리보기 (브라우저) |
| `GET` | `/health` | 서버 상태 및 스케줄 확인 |

---

## Slack 봇 설정

**필요한 Bot Token Scopes:**
- `chat:write` — 메시지 전송
- `files:write` — HTML 미리보기 파일 업로드
- `channels:read` — 채널 정보 조회
- `channels:join` — 채널 자동 가입
- `app_mentions:read` — 봇 멘션 수신 (키워드 트리거용)

**Socket Mode**를 활성화해야 버튼(승인/거부) 인터랙션이 동작합니다.

**키워드 트리거**: Slack에서 봇을 멘션하면 키워드를 자동 분류하여 해당 뉴스레터를 생성합니다.

```
@AI Newsletter Bot 테슬라 전기차     → 자동차 뉴스레터
@AI Newsletter Bot 쿠버네티스        → IT 뉴스레터
@AI Newsletter Bot KCC 신규 사업     → KCC 소식지
```

---

## 커스터마이징

### 뉴스 수집 소스 변경

각 scout 파일의 `RSS_SOURCES` 딕셔너리에서 소스를 추가/제거합니다.

- IT: `src/agents/it_scout.py`
- 자동차: `src/agents/auto_scout.py`
- KCC 블로그: `src/agents/kcc_scout.py` (RSS URL 변경)

### AI 선별·작성 기준 변경

각 curator/editor 파일의 `SYSTEM_INSTRUCTION` 문자열을 수정합니다.

- IT 선별: `src/agents/it_curator.py`
- IT 작성: `src/agents/it_editor.py`
- 자동차 선별: `src/agents/auto_curator.py`
- 자동차 작성: `src/agents/auto_editor.py`
- KCC 작성: `src/agents/kcc_editor.py`

### HTML 템플릿 수정

`templates/newsletter.html` — Jinja2 문법 사용. 이메일 클라이언트 호환을 위해 **인라인 CSS + 테이블 레이아웃** 유지 필요.

주요 Jinja2 변수:

```
{{ content.intro }}              → 인트로 문구
{{ content.generated_at[:10] }} → 생성 날짜

{% for article in content.articles %}
  {{ article.category }}        → 카테고리
  {{ article.headline }}        → 헤드라인
  {{ article.summary }}         → 한줄 요약
  {{ article.body }}            → 본문
  {{ article.original_link }}   → 원문 URL
  {{ images[loop.index0] }}     → 이미지 정보 (type: og/generated/none)
{% endfor %}
```

---

## 데이터 저장

DB 없이 JSON 파일로 상태를 관리합니다.

```
data/collected/YYYY-MM-DD.json   — 수집된 원본 기사
data/newsletters/{id}.json       — 생성된 뉴스레터 전체 데이터
data/images/{id}_{index}.png     — Gemini 생성 이미지
```

뉴스레터 상태 흐름:
```
pending → (Slack 승인) → approved → sent
        → (Slack 거부) → rejected
```

---

## 기술 스택

| 역할 | 라이브러리 |
|------|-----------|
| AI 텍스트 + 이미지 | `google-genai` (Gemini 2.5 Flash) |
| RSS 파싱 | `feedparser` + `httpx` |
| 이미지 추출 | `httpx` + `beautifulsoup4` |
| HTML 템플릿 | `jinja2` |
| 이메일 발송 | `aiosmtplib` (Gmail SMTP) |
| Slack 연동 | `slack-bolt` (Socket Mode) |
| 스케줄링 | `apscheduler` |
| 웹 서버 | `fastapi` + `uvicorn` |
| 설정 관리 | `pydantic-settings` |
