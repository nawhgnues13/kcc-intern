import sys
import os
sys.path.append(os.getcwd())

from src.db import SessionLocal
from src.models.article import Article
from sqlalchemy import select

def fix_article_images(article_id: str):
    with SessionLocal() as db:
        article = db.scalar(select(Article).where(Article.id == article_id))
        if not article:
            print("Article not found!")
            return
            
        modified = False
        if "content" in article.body_content:
            for block in article.body_content["content"]:
                if block.get("type") == "image":
                    src = block.get("attrs", {}).get("src", "")
                    if "f4c9.jpg" in src:
                        block["attrs"]["src"] = src.replace("f4c9.jpg", "f94c9.jpg")
                        modified = True
                        print("Fixed hallucinated URL in block!")
        
        if modified:
            # SQLAlchemy JSON mutation tracking might need full reassignment
            temp = article.body_content.copy()
            article.body_content = temp
            db.commit()
            print("Successfully updated article in DB!")
            
if __name__ == "__main__":
    fix_article_images("00342844-8dd5-4700-88d2-3c3e99005a7d")
    fix_article_images("75568d95-a930-41af-9399-803660e550a9")

