import sys
import os
sys.path.append(os.getcwd())
from src.db import SessionLocal
from src.models.sales_registration import SalesRegistration

def main():
    with SessionLocal() as db:
        regs = db.query(SalesRegistration).all()
        print("Registrations:")
        for r in regs:
            print(f"- id={r.id}, ext_cont_no='{r.external_contract_no}', cust='{r.customer_name}'")

if __name__ == "__main__":
    main()
