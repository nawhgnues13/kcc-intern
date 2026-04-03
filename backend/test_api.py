import requests
import json
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

print("Testing API...")
try:
    res = requests.post("http://127.0.0.1:8000/api/crm/sales-registrations/import", data={
        "user_id": "5414f544-886b-4866-a165-e0122f416a9f",
        "delivery_payload": json.dumps(data),
        "requested_contents": '[{"content_format": "blog", "template_style": "blog_naver_basic"}]',
        "photo_descriptions": '["desc1"]',
        "note": "test"
    }, files={
        "files": ("test.png", b"fakeimg", "image/png")
    }, timeout=3)
    
    print("API RESPONSE:", res.status_code, res.text)
except Exception as e:
    print("API FAILED")
    traceback.print_exc()
