from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.db import get_db
from src.models.customer import Customer
from src.models.email_unsubscribe import EmailUnsubscribe
from src.models.employee import Employee

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("")
def list_customers(employee_email: str | None = None, db: Session = Depends(get_db)):
    unsubscribed = {row.email.lower() for row in db.query(EmailUnsubscribe.email).all()}

    query = db.query(Customer).filter(Customer.deleted_at.is_(None))

    if employee_email:
        employee = db.query(Employee).filter(
            Employee.email == employee_email,
            Employee.deleted_at.is_(None),
        ).first()
        if employee:
            query = query.filter(Customer.employee_id == employee.id)
        else:
            return {"items": []}

    customers = query.all()
    return {
        "items": [
            {"name": c.name, "email": c.email}
            for c in customers
            if c.email.lower() not in unsubscribed
        ]
    }
