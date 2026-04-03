import json
from src.schemas.crm import ExternalSalesDeliveryItemResponse
from datetime import datetime
import traceback

data = {
    "showroomName": "강서목동전시장",
    "departmentName": "1팀",
    "employeeName": "홍길동",
    "customerName": "김철수",
    "externalContractNo": "100001",
    "vehicleModel": "E-Class",
    "className": "E 200 AV",
    "carYear": "2026",
    "exteriorColor": "Polar White",
    "interiorColor": "black",
    "salePrice": 76500000.0,
    "invoicePrice": 65002500.0,
    "saleDate": "2026-02-01T12:00:00",
    "contractDate": "2026-01-15T12:00:00",
    "isImported": False,
    "rawDelivery": {}
}

print("Testing validation...")
try:
    obj = ExternalSalesDeliveryItemResponse(**data)
    print("SUCCESS!")
except Exception as e:
    print("FAILED!")
    traceback.print_exc()
