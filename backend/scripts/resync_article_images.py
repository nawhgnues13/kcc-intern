import argparse
import sys
from pathlib import Path
from uuid import UUID

from sqlalchemy import select

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.db import SessionLocal
from src.models.article import Article
from src.models.article_image import ArticleImage
from src.services.newsletter_service import _extract_image_urls, resync_article_images


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Resync article_images from each article's body_content image nodes.",
    )
    parser.add_argument(
        "--article-id",
        action="append",
        help="Specific article UUID to repair. Can be passed multiple times.",
    )
    parser.add_argument(
        "--only-missing",
        action="store_true",
        help="Repair only articles that currently have no active article_images rows.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show which articles would be repaired without writing changes.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    article_ids: list[UUID] = []
    if args.article_id:
        try:
            article_ids = [UUID(raw_id) for raw_id in args.article_id]
        except ValueError as exc:
            print(f"[ERROR] Invalid article UUID: {exc}")
            return 1

    db = SessionLocal()
    try:
        stmt = select(Article).where(Article.deleted_at.is_(None)).order_by(Article.created_at.desc())
        if article_ids:
            stmt = stmt.where(Article.id.in_(article_ids))

        articles = list(db.scalars(stmt))
        repaired_count = 0
        skipped_count = 0

        for article in articles:
            extracted_urls = _extract_image_urls(article.body_content or {})
            active_image_count = len(
                list(
                    db.scalars(
                        select(ArticleImage).where(
                            ArticleImage.article_id == article.id,
                            ArticleImage.deleted_at.is_(None),
                        )
                    )
                )
            )

            should_skip = False
            if args.only_missing and active_image_count > 0:
                should_skip = True
            if not extracted_urls:
                should_skip = True

            if should_skip:
                skipped_count += 1
                continue

            if args.dry_run:
                print(
                    f"[DRY-RUN] article={article.id} title={article.title!r} "
                    f"existing_images={active_image_count} extracted_images={len(extracted_urls)}"
                )
                repaired_count += 1
                continue

            new_count = resync_article_images(db=db, article_id=article.id)
            print(
                f"[OK] article={article.id} title={article.title!r} "
                f"existing_images={active_image_count} -> synced_images={new_count}"
            )
            repaired_count += 1

        print(
            f"[DONE] repaired={repaired_count} skipped={skipped_count} "
            f"mode={'dry-run' if args.dry_run else 'write'}"
        )
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
