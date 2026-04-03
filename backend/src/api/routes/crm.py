from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from src.db import get_db
from src.schemas.crm import (
    CustomerListResponse,
    ExternalSalesDeliveryListResponse,
    GroomingRegistrationListResponse,
    GroomingRegistrationResponse,
    SalesRegistrationListResponse,
    SalesRegistrationResponse,
    ServiceRegistrationListResponse,
    ServiceRegistrationResponse,
)
from src.services.crm_service import (
    create_grooming_registration,
    create_sales_registration,
    create_service_registration,
    delete_grooming_registration,
    delete_sales_registration,
    delete_service_registration,
    get_grooming_registration_detail,
    import_external_sales_registration,
    list_external_sales_deliveries,
    get_sales_registration_detail,
    get_service_registration_detail,
    list_customers,
    list_grooming_registrations,
    list_sales_registrations,
    list_service_registrations,
    parse_datetime_value,
    parse_delivery_payload,
    parse_existing_photo_descriptions,
    parse_force_regenerate_formats,
    parse_keep_photo_ids,
    parse_photo_descriptions,
    parse_requested_contents,
    update_grooming_registration,
    update_sales_registration,
    update_service_registration,
)

router = APIRouter(prefix="/api/crm", tags=["crm"])


@router.get("/customers", response_model=CustomerListResponse)
async def list_customers_route(
    employee_email: str | None = None,
    db: Session = Depends(get_db),
):
    return list_customers(db=db, employee_email=employee_email)


def _clean_files(files: list[UploadFile]) -> list[UploadFile]:
    return [file for file in files if file.filename]


@router.post("/sales-registrations", response_model=SalesRegistrationResponse)
async def create_sales_registration_route(
    employee_id: UUID = Form(...),
    external_contract_no: str | None = Form(default=None),
    customer_name: str = Form(...),
    customer_phone: str | None = Form(default=None),
    customer_email: str | None = Form(default=None),
    vehicle_model: str = Form(...),
    class_name: str | None = Form(default=None),
    car_year: str | None = Form(default=None),
    exterior_color: str | None = Form(default=None),
    interior_color: str | None = Form(default=None),
    sale_price: float | None = Form(default=None),
    invoice_price: float | None = Form(default=None),
    sale_date: str = Form(...),
    contract_date: str | None = Form(default=None),
    branch_name: str | None = Form(default=None),
    note: str | None = Form(default=None),
    requested_contents: str | None = Form(default=None),
    force_regenerate_formats: str | None = Form(default=None),
    photo_descriptions: str | None = Form(default=None),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    return await create_sales_registration(
        db=db,
        payload={
            "employee_id": employee_id,
            "external_contract_no": external_contract_no,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "customer_email": customer_email,
            "vehicle_model": vehicle_model,
            "class_name": class_name,
            "car_year": car_year,
            "exterior_color": exterior_color,
            "interior_color": interior_color,
            "sale_price": sale_price,
            "invoice_price": invoice_price,
            "sale_date": parse_datetime_value(sale_date, "sale_date"),
            "contract_date": parse_datetime_value(contract_date, "contract_date") if contract_date else None,
            "branch_name": branch_name,
            "note": note,
        },
        requested_contents=parse_requested_contents(requested_contents),
        force_regenerate_formats=parse_force_regenerate_formats(force_regenerate_formats),
        photo_descriptions=parse_photo_descriptions(photo_descriptions),
        files=_clean_files(files),
    )


@router.get("/sales-registrations", response_model=SalesRegistrationListResponse)
async def list_sales_registrations_route(db: Session = Depends(get_db)):
    return list_sales_registrations(db=db)


@router.get("/sales-registrations/{registration_id}", response_model=SalesRegistrationResponse)
async def get_sales_registration_detail_route(registration_id: UUID, db: Session = Depends(get_db)):
    return get_sales_registration_detail(db=db, registration_id=registration_id)


@router.put("/sales-registrations/{registration_id}", response_model=SalesRegistrationResponse)
async def update_sales_registration_route(
    registration_id: UUID,
    employee_id: UUID = Form(...),
    external_contract_no: str | None = Form(default=None),
    customer_name: str = Form(...),
    customer_phone: str | None = Form(default=None),
    customer_email: str | None = Form(default=None),
    vehicle_model: str = Form(...),
    class_name: str | None = Form(default=None),
    car_year: str | None = Form(default=None),
    exterior_color: str | None = Form(default=None),
    interior_color: str | None = Form(default=None),
    sale_price: float | None = Form(default=None),
    invoice_price: float | None = Form(default=None),
    sale_date: str = Form(...),
    contract_date: str | None = Form(default=None),
    branch_name: str | None = Form(default=None),
    note: str | None = Form(default=None),
    requested_contents: str | None = Form(default=None),
    force_regenerate_formats: str | None = Form(default=None),
    keep_photo_ids: str | None = Form(default=None),
    photo_descriptions: str | None = Form(default=None),
    existing_photo_descriptions: str | None = Form(default=None),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    return await update_sales_registration(
        db=db,
        registration_id=registration_id,
        payload={
            "employee_id": employee_id,
            "external_contract_no": external_contract_no,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "customer_email": customer_email,
            "vehicle_model": vehicle_model,
            "class_name": class_name,
            "car_year": car_year,
            "exterior_color": exterior_color,
            "interior_color": interior_color,
            "sale_price": sale_price,
            "invoice_price": invoice_price,
            "sale_date": parse_datetime_value(sale_date, "sale_date"),
            "contract_date": parse_datetime_value(contract_date, "contract_date") if contract_date else None,
            "branch_name": branch_name,
            "note": note,
        },
        requested_contents=parse_requested_contents(requested_contents),
        force_regenerate_formats=parse_force_regenerate_formats(force_regenerate_formats),
        keep_photo_ids=parse_keep_photo_ids(keep_photo_ids),
        photo_descriptions=parse_photo_descriptions(photo_descriptions),
        existing_photo_descriptions=parse_existing_photo_descriptions(existing_photo_descriptions),
        files=_clean_files(files),
    )

@router.delete("/sales-registrations/{registration_id}", status_code=204)
async def delete_sales_registration_route(registration_id: UUID, db: Session = Depends(get_db)):
    delete_sales_registration(db=db, registration_id=registration_id)
@router.get("/external/sales-deliveries", response_model=ExternalSalesDeliveryListResponse)
async def list_external_sales_deliveries_route(
    user_id: UUID,
    delivery_date_from: str,
    delivery_date_to: str,
    db: Session = Depends(get_db),
):
    return await list_external_sales_deliveries(
        db=db,
        user_id=user_id,
        delivery_date_from=delivery_date_from,
        delivery_date_to=delivery_date_to,
    )


@router.post("/sales-registrations/import", response_model=SalesRegistrationResponse)
async def import_external_sales_registration_route(
    user_id: UUID = Form(...),
    delivery_payload: str = Form(...),
    note: str | None = Form(default=None),
    requested_contents: str | None = Form(default=None),
    photo_descriptions: str | None = Form(default=None),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    return await import_external_sales_registration(
        db=db,
        user_id=user_id,
        delivery_payload=parse_delivery_payload(delivery_payload),
        note=note,
        requested_contents=parse_requested_contents(requested_contents),
        photo_descriptions=parse_photo_descriptions(photo_descriptions),
        files=_clean_files(files),
    )


@router.post("/service-registrations", response_model=ServiceRegistrationResponse)
async def create_service_registration_route(
    employee_id: UUID = Form(...),
    customer_name: str = Form(...),
    customer_phone: str | None = Form(default=None),
    customer_email: str | None = Form(default=None),
    vehicle_model: str = Form(...),
    service_date: str = Form(...),
    repair_details: str = Form(...),
    repair_cost: float | None = Form(default=None),
    branch_name: str | None = Form(default=None),
    note: str | None = Form(default=None),
    requested_contents: str | None = Form(default=None),
    force_regenerate_formats: str | None = Form(default=None),
    photo_descriptions: str | None = Form(default=None),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    return await create_service_registration(
        db=db,
        payload={
            "employee_id": employee_id,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "customer_email": customer_email,
            "vehicle_model": vehicle_model,
            "service_date": parse_datetime_value(service_date, "service_date"),
            "repair_details": repair_details,
            "repair_cost": repair_cost,
            "branch_name": branch_name,
            "note": note,
        },
        requested_contents=parse_requested_contents(requested_contents),
        force_regenerate_formats=parse_force_regenerate_formats(force_regenerate_formats),
        photo_descriptions=parse_photo_descriptions(photo_descriptions),
        files=_clean_files(files),
    )


@router.get("/service-registrations", response_model=ServiceRegistrationListResponse)
async def list_service_registrations_route(db: Session = Depends(get_db)):
    return list_service_registrations(db=db)


@router.get("/service-registrations/{registration_id}", response_model=ServiceRegistrationResponse)
async def get_service_registration_detail_route(registration_id: UUID, db: Session = Depends(get_db)):
    return get_service_registration_detail(db=db, registration_id=registration_id)


@router.put("/service-registrations/{registration_id}", response_model=ServiceRegistrationResponse)
async def update_service_registration_route(
    registration_id: UUID,
    employee_id: UUID = Form(...),
    customer_name: str = Form(...),
    customer_phone: str | None = Form(default=None),
    customer_email: str | None = Form(default=None),
    vehicle_model: str = Form(...),
    service_date: str = Form(...),
    repair_details: str = Form(...),
    repair_cost: float | None = Form(default=None),
    branch_name: str | None = Form(default=None),
    note: str | None = Form(default=None),
    requested_contents: str | None = Form(default=None),
    force_regenerate_formats: str | None = Form(default=None),
    keep_photo_ids: str | None = Form(default=None),
    photo_descriptions: str | None = Form(default=None),
    existing_photo_descriptions: str | None = Form(default=None),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    return await update_service_registration(
        db=db,
        registration_id=registration_id,
        payload={
            "employee_id": employee_id,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "customer_email": customer_email,
            "vehicle_model": vehicle_model,
            "service_date": parse_datetime_value(service_date, "service_date"),
            "repair_details": repair_details,
            "repair_cost": repair_cost,
            "branch_name": branch_name,
            "note": note,
        },
        requested_contents=parse_requested_contents(requested_contents),
        force_regenerate_formats=parse_force_regenerate_formats(force_regenerate_formats),
        keep_photo_ids=parse_keep_photo_ids(keep_photo_ids),
        photo_descriptions=parse_photo_descriptions(photo_descriptions),
        existing_photo_descriptions=parse_existing_photo_descriptions(existing_photo_descriptions),
        files=_clean_files(files),
    )


@router.delete("/service-registrations/{registration_id}", status_code=204)
async def delete_service_registration_route(registration_id: UUID, db: Session = Depends(get_db)):
    delete_service_registration(db=db, registration_id=registration_id)


@router.post("/grooming-registrations", response_model=GroomingRegistrationResponse)
async def create_grooming_registration_route(
    employee_id: UUID = Form(...),
    customer_name: str = Form(...),
    customer_phone: str | None = Form(default=None),
    customer_email: str | None = Form(default=None),
    pet_name: str = Form(...),
    pet_type: str | None = Form(default=None),
    breed: str | None = Form(default=None),
    grooming_details: str = Form(...),
    price: float | None = Form(default=None),
    grooming_date: str = Form(...),
    branch_name: str | None = Form(default=None),
    note: str | None = Form(default=None),
    requested_contents: str | None = Form(default=None),
    force_regenerate_formats: str | None = Form(default=None),
    photo_descriptions: str | None = Form(default=None),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    return await create_grooming_registration(
        db=db,
        payload={
            "employee_id": employee_id,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "customer_email": customer_email,
            "pet_name": pet_name,
            "pet_type": pet_type,
            "breed": breed,
            "grooming_details": grooming_details,
            "price": price,
            "grooming_date": parse_datetime_value(grooming_date, "grooming_date"),
            "branch_name": branch_name,
            "note": note,
        },
        requested_contents=parse_requested_contents(requested_contents),
        force_regenerate_formats=parse_force_regenerate_formats(force_regenerate_formats),
        photo_descriptions=parse_photo_descriptions(photo_descriptions),
        files=_clean_files(files),
    )


@router.get("/grooming-registrations", response_model=GroomingRegistrationListResponse)
async def list_grooming_registrations_route(db: Session = Depends(get_db)):
    return list_grooming_registrations(db=db)


@router.get("/grooming-registrations/{registration_id}", response_model=GroomingRegistrationResponse)
async def get_grooming_registration_detail_route(registration_id: UUID, db: Session = Depends(get_db)):
    return get_grooming_registration_detail(db=db, registration_id=registration_id)


@router.put("/grooming-registrations/{registration_id}", response_model=GroomingRegistrationResponse)
async def update_grooming_registration_route(
    registration_id: UUID,
    employee_id: UUID = Form(...),
    customer_name: str = Form(...),
    customer_phone: str | None = Form(default=None),
    customer_email: str | None = Form(default=None),
    pet_name: str = Form(...),
    pet_type: str | None = Form(default=None),
    breed: str | None = Form(default=None),
    grooming_details: str = Form(...),
    price: float | None = Form(default=None),
    grooming_date: str = Form(...),
    branch_name: str | None = Form(default=None),
    note: str | None = Form(default=None),
    requested_contents: str | None = Form(default=None),
    force_regenerate_formats: str | None = Form(default=None),
    keep_photo_ids: str | None = Form(default=None),
    photo_descriptions: str | None = Form(default=None),
    existing_photo_descriptions: str | None = Form(default=None),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    return await update_grooming_registration(
        db=db,
        registration_id=registration_id,
        payload={
            "employee_id": employee_id,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "customer_email": customer_email,
            "pet_name": pet_name,
            "pet_type": pet_type,
            "breed": breed,
            "grooming_details": grooming_details,
            "price": price,
            "grooming_date": parse_datetime_value(grooming_date, "grooming_date"),
            "branch_name": branch_name,
            "note": note,
        },
        requested_contents=parse_requested_contents(requested_contents),
        force_regenerate_formats=parse_force_regenerate_formats(force_regenerate_formats),
        keep_photo_ids=parse_keep_photo_ids(keep_photo_ids),
        photo_descriptions=parse_photo_descriptions(photo_descriptions),
        existing_photo_descriptions=parse_existing_photo_descriptions(existing_photo_descriptions),
        files=_clean_files(files),
    )


@router.delete("/grooming-registrations/{registration_id}", status_code=204)
async def delete_grooming_registration_route(registration_id: UUID, db: Session = Depends(get_db)):
    delete_grooming_registration(db=db, registration_id=registration_id)
