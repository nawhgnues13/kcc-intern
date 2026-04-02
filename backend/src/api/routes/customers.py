from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.db import get_db
from src.models.customer import Customer
from src.models.email_unsubscribe import EmailUnsubscribe

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("")
def list_customers(db: Session = Depends(get_db)):
    unsubscribed = {row.email.lower() for row in db.query(EmailUnsubscribe.email).all()}
    customers = (
        db.query(Customer)
        .filter(Customer.deleted_at.is_(None))
        .all()
    )
    return {
        "items": [
            {"name": c.name, "email": c.email}
            for c in customers
            if c.email.lower() not in unsubscribed
        ]
    }
