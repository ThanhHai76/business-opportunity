"""Opportunity scoring engine.

Turns an area's growth metrics (population, metro, apartments, schools,
offices — each 0-100) into a ranked list of business-opportunity scores,
one per business type, penalized by how saturated that type already is in
the area.

This is intentionally a transparent, tunable weighted-sum model rather than
a black box — every score comes with the metrics that drove it, which
matters for a B2B tool where the customer needs to trust *why* a
recommendation was made.
"""
from dataclasses import dataclass
from typing import Dict, List

METRIC_LABELS = {
    "population_growth": "Dân số",
    "metro_growth": "Hạ tầng Metro",
    "apartment_growth": "Chung cư mới",
    "school_growth": "Trường học",
    "office_growth": "Văn phòng",
}

BUSINESS_TYPES: Dict[str, dict] = {
    "cafe": {
        "name": "Quán Cafe",
        "icon": "☕",
        "description": "Cafe, coffee to-go, không gian làm việc",
        "weights": {
            "population_growth": 0.25,
            "office_growth": 0.30,
            "apartment_growth": 0.20,
            "school_growth": 0.10,
            "metro_growth": 0.15,
        },
    },
    "fnb": {
        "name": "Nhà hàng / F&B",
        "icon": "🍜",
        "description": "Nhà hàng, quán ăn, đồ ăn nhanh",
        "weights": {
            "population_growth": 0.30,
            "apartment_growth": 0.25,
            "office_growth": 0.20,
            "metro_growth": 0.15,
            "school_growth": 0.10,
        },
    },
    "gym": {
        "name": "Gym / Fitness",
        "icon": "🏋️",
        "description": "Phòng gym, yoga, fitness center",
        "weights": {
            "population_growth": 0.25,
            "apartment_growth": 0.40,
            "office_growth": 0.25,
            "metro_growth": 0.05,
            "school_growth": 0.05,
        },
    },
    "education": {
        "name": "Giáo dục trẻ em",
        "icon": "🧒",
        "description": "Mầm non, trung tâm ngoại ngữ, năng khiếu",
        "weights": {
            "population_growth": 0.30,
            "school_growth": 0.40,
            "apartment_growth": 0.25,
            "office_growth": 0.00,
            "metro_growth": 0.05,
        },
    },
    "convenience": {
        "name": "Cửa hàng tiện lợi",
        "icon": "🛒",
        "description": "Minimart, convenience store 24/7",
        "weights": {
            "population_growth": 0.35,
            "metro_growth": 0.25,
            "apartment_growth": 0.30,
            "office_growth": 0.05,
            "school_growth": 0.05,
        },
    },
    "beauty": {
        "name": "Beauty / Spa",
        "icon": "💇",
        "description": "Salon tóc, spa, nail, chăm sóc sắc đẹp",
        "weights": {
            "population_growth": 0.25,
            "apartment_growth": 0.30,
            "office_growth": 0.20,
            "metro_growth": 0.15,
            "school_growth": 0.10,
        },
    },
    "pharmacy": {
        "name": "Nhà thuốc / Y tế",
        "icon": "🏥",
        "description": "Nhà thuốc, phòng khám tư, dịch vụ y tế cơ bản",
        "weights": {
            "population_growth": 0.35,
            "apartment_growth": 0.35,
            "school_growth": 0.10,
            "office_growth": 0.10,
            "metro_growth": 0.10,
        },
    },
    "petshop": {
        "name": "Thú cưng",
        "icon": "🐾",
        "description": "Pet shop, spa thú cưng, phòng khám thú y",
        "weights": {
            "population_growth": 0.30,
            "apartment_growth": 0.40,
            "office_growth": 0.15,
            "metro_growth": 0.10,
            "school_growth": 0.05,
        },
    },
    "realestate": {
        "name": "Bất động sản / Môi giới",
        "icon": "🏠",
        "description": "Văn phòng môi giới, sàn giao dịch bất động sản",
        "weights": {
            "apartment_growth": 0.45,
            "metro_growth": 0.25,
            "population_growth": 0.15,
            "office_growth": 0.10,
            "school_growth": 0.05,
        },
    },
    "laundry": {
        "name": "Giặt ủi",
        "icon": "🧺",
        "description": "Giặt sấy tự động/công nghiệp, giặt ủi theo giờ",
        "weights": {
            "apartment_growth": 0.35,
            "office_growth": 0.25,
            "population_growth": 0.25,
            "metro_growth": 0.10,
            "school_growth": 0.05,
        },
    },
    "bookstore": {
        "name": "Nhà sách / Văn phòng phẩm",
        "icon": "📚",
        "description": "Nhà sách, văn phòng phẩm, đồ dùng học tập",
        "weights": {
            "school_growth": 0.40,
            "population_growth": 0.30,
            "apartment_growth": 0.20,
            "office_growth": 0.05,
            "metro_growth": 0.05,
        },
    },
    "carwash": {
        "name": "Sửa xe / Rửa xe",
        "icon": "🚗",
        "description": "Rửa xe, bảo dưỡng, sửa chữa ô tô - xe máy",
        "weights": {
            "population_growth": 0.35,
            "apartment_growth": 0.30,
            "office_growth": 0.20,
            "school_growth": 0.10,
            "metro_growth": 0.05,
        },
    },
}


@dataclass
class Opportunity:
    type_id: str
    name: str
    icon: str
    description: str
    demand_score: float
    competition_index: float
    opportunity_score: float
    top_drivers: List[str]


def _clip(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def score_area(metrics: Dict[str, float], competition: Dict[str, float]) -> List[Opportunity]:
    """Compute a ranked list of business opportunities for one area.

    demand_score   = weighted sum of growth metrics (0-100)
    opportunity_score = demand_score, discounted by existing competition/
                         saturation for that business type (0-100)
    """
    results: List[Opportunity] = []
    for type_id, spec in BUSINESS_TYPES.items():
        weights = spec["weights"]
        demand = sum(metrics.get(m, 0.0) * w for m, w in weights.items())
        comp = competition.get(type_id, 30.0)
        opportunity = _clip(demand - comp * 0.4)

        drivers = sorted(weights.items(), key=lambda kv: kv[1], reverse=True)[:2]
        top_drivers = [METRIC_LABELS[m] for m, _ in drivers if weights[m] > 0]

        results.append(
            Opportunity(
                type_id=type_id,
                name=spec["name"],
                icon=spec["icon"],
                description=spec["description"],
                demand_score=round(demand, 1),
                competition_index=round(comp, 1),
                opportunity_score=round(opportunity, 1),
                top_drivers=top_drivers,
            )
        )

    results.sort(key=lambda o: o.opportunity_score, reverse=True)
    return results
