import sys
import os
import json
sys.path.append(os.getcwd())

from src.db import SessionLocal
from src.models.article import Article

def main():
    with SessionLocal() as db:
        article = db.query(Article).filter_by(id="00342844-8dd5-4700-88d2-3c3e99005a7d").first()
        if article:
            with open("tmp_article.json", "w", encoding="utf-8") as f:
                json.dump(article.body_content, f, ensure_ascii=False, indent=2)
            print("Wrote to tmp_article.json")
        else:
            print("Article not found.")

if __name__ == "__main__":
    main()
