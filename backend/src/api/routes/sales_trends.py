import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/trends", tags=["sales-trends"])

_DATA_PATH = Path(__file__).parent.parent.parent.parent / "data" / "mercedes_sales.json"


def _load_data() -> list[dict]:
    try:
        with open(_DATA_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


_RECORDS: list[dict] = _load_data()


def _birth_to_age_group(birth_dt: str) -> Optional[str]:
    try:
        birth_year = int(birth_dt[:4])
        age = datetime.now().year - birth_year
        if age < 30:
            return "20대 이하"
        elif age < 40:
            return "30대"
        elif age < 50:
            return "40대"
        elif age < 60:
            return "50대"
        elif age < 70:
            return "60대"
        else:
            return "70대 이상"
    except Exception:
        return None


def _filter_records(
    gender: Optional[str],
    age_groups: Optional[list[str]],
    price_min: Optional[int],
    price_max: Optional[int],
    showrooms: Optional[list[str]],
    jobs: Optional[list[str]],
    date_from: Optional[str],  # YYYYMMDD
    date_to: Optional[str],    # YYYYMMDD
) -> list[dict]:
    result = []
    for r in _RECORDS:
        if gender and r.get("custGender") != gender:
            continue
        if age_groups:
            ag = _birth_to_age_group(r.get("custBirthDt", ""))
            if ag not in age_groups:
                continue
        if price_min is not None or price_max is not None:
            try:
                price = int(r.get("carPrice", 0)) // 10000
            except Exception:
                price = 0
            if price_min is not None and price < price_min:
                continue
            if price_max is not None and price > price_max:
                continue
        if showrooms and r.get("showroomNm") not in showrooms:
            continue
        if jobs and r.get("custJob") not in jobs:
            continue
        delivery = r.get("deliveryDt", "")
        if date_from and delivery < date_from:
            continue
        if date_to and delivery > date_to:
            continue
        result.append(r)
    return result


@router.get("/models")
def get_model_ranking(
    gender: Optional[str] = Query(None),
    age_groups: Optional[list[str]] = Query(None),
    price_min: Optional[int] = Query(None),
    price_max: Optional[int] = Query(None),
    showrooms: Optional[list[str]] = Query(None),
    jobs: Optional[list[str]] = Query(None),
    date_from: Optional[str] = Query(None, description="출고일 시작 YYYYMMDD"),
    date_to: Optional[str] = Query(None, description="출고일 종료 YYYYMMDD"),
):
    records = _filter_records(gender, age_groups, price_min, price_max, showrooms, jobs, date_from, date_to)

    model_counter = Counter(r.get("modelNm", "기타") for r in records)
    class_counter = Counter(r.get("classNm", "기타") for r in records)

    total = len(records)
    model_ranking = [
        {"model": model, "count": count, "percent": round(count / total * 100, 1) if total else 0}
        for model, count in model_counter.most_common()
    ]
    class_ranking = [
        {"class": cls, "count": count, "percent": round(count / total * 100, 1) if total else 0}
        for cls, count in class_counter.most_common()
    ]

    return {"total": total, "model_ranking": model_ranking, "class_ranking": class_ranking}


@router.get("/colors")
def get_color_ranking(
    model: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    records = _RECORDS
    if model:
        records = [r for r in records if r.get("modelNm") == model]
    if date_from:
        records = [r for r in records if r.get("deliveryDt", "") >= date_from]
    if date_to:
        records = [r for r in records if r.get("deliveryDt", "") <= date_to]

    total = len(records)
    ext_counter = Counter(r.get("extColor", "기타").lower() for r in records)
    in_counter = Counter(r.get("inColor", "기타").lower() for r in records)

    ext_ranking = [
        {"color": color, "count": count, "percent": round(count / total * 100, 1) if total else 0}
        for color, count in ext_counter.most_common(10)
    ]
    in_ranking = [
        {"color": color, "count": count, "percent": round(count / total * 100, 1) if total else 0}
        for color, count in in_counter.most_common(10)
    ]

    return {"total": total, "model_filter": model, "exterior_colors": ext_ranking, "interior_colors": in_ranking}


@router.get("/filters")
def get_filter_options():
    genders = sorted(set(r.get("custGender", "") for r in _RECORDS if r.get("custGender")))
    showrooms = sorted(set(r.get("showroomNm", "") for r in _RECORDS if r.get("showroomNm")))
    models = sorted(set(r.get("modelNm", "") for r in _RECORDS if r.get("modelNm")))

    job_counts = Counter(r.get("custJob", "") for r in _RECORDS if r.get("custJob"))
    jobs = [j for j, _ in job_counts.most_common()]

    age_groups_order = ["20대 이하", "30대", "40대", "50대", "60대", "70대 이상"]
    present_age_groups = set(
        _birth_to_age_group(r.get("custBirthDt", ""))
        for r in _RECORDS
        if r.get("custBirthDt")
    )
    age_groups = [ag for ag in age_groups_order if ag in present_age_groups]

    prices = []
    delivery_dates = []
    for r in _RECORDS:
        try:
            prices.append(int(r.get("carPrice", 0)) // 10000)
        except Exception:
            pass
        d = r.get("deliveryDt", "")
        if len(d) == 8:
            delivery_dates.append(d)

    min_date = min(delivery_dates) if delivery_dates else "20260101"
    max_date = max(delivery_dates) if delivery_dates else "20260131"

    return {
        "genders": genders,
        "age_groups": age_groups,
        "showrooms": showrooms,
        "models": models,
        "jobs": jobs,
        "price_range": {
            "min": min(prices) if prices else 0,
            "max": max(prices) if prices else 0,
        },
        "date_range": {
            "min": min_date,
            "max": max_date,
        },
    }
