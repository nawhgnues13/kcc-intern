import sys
import os
sys.path.append(os.getcwd())

from src.db import SessionLocal
from src.models.sales_registration import SalesRegistration, SalesPhoto
from src.models.article import Article
from src.models.content_task import ContentTask

def main():
    with SessionLocal() as db:
        # Get the latest sales registration
        latest_reg = db.query(SalesRegistration).order_by(SalesRegistration.created_at.desc()).first()
        if not latest_reg:
            print("No sales registrations found.")
            return

        print(f"Latest Sales Registration: ID={latest_reg.id}, CreatedAt={latest_reg.created_at}")

        photos = db.query(SalesPhoto).filter_by(sales_registration_id=latest_reg.id).order_by(SalesPhoto.sort_order).all()
        print(f"\nPhotos ({len(photos)}):")
        for p in photos:
            print(f"  - Order={p.sort_order}, Desc='{p.photo_description}', URL='{p.file_url}'")
        
        print("\nRelated Content Tasks:")
        tasks = db.query(ContentTask).filter_by(source_id=latest_reg.id).all()
        for t in tasks:
            print(f"  - TaskID={t.id}, Format={t.content_format}, Status={t.status}")
            if t.article_id:
                article = db.query(Article).filter_by(id=t.article_id).first()
                print(f"    - Linked Article: ID={article.id}")

if __name__ == "__main__":
    main()
