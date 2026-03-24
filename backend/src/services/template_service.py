from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from src.models.schemas import ImageInfo, NewsletterContent

# 템플릿 디렉토리는 프로젝트 루트 기준
_TEMPLATE_DIR = Path(__file__).parent.parent.parent / "templates"
env = Environment(loader=FileSystemLoader(str(_TEMPLATE_DIR)), auto_reload=True)


def render(content: NewsletterContent, images: list[ImageInfo], newsletter_type: str = "it") -> str:
    template = env.get_template("newsletter.html")
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(content.generated_at)
        formatted_date = f"{dt.year}. {dt.month}. {dt.day}"
    except Exception:
        formatted_date = content.generated_at[:10]
    return template.render(content=content, images=images, newsletter_type=newsletter_type, formatted_date=formatted_date)
