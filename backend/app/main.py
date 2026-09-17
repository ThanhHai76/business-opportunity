"""FastAPI backend for "Google Maps cho cơ hội kinh doanh" — an area
opportunity-scoring API. See README.md at the project root for how to run
this alongside the Angular frontend.
"""
import json
from typing import List

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import Area
from . import seed_data, schemas
from .scoring import BUSINESS_TYPES, score_area

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Business Opportunity Map API",
    description="Gợi ý loại hình kinh doanh tiềm năng theo khu vực, dựa trên xu hướng dân số, hạ tầng metro, chung cư, trường học và văn phòng.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    db = next(get_db())
    seed_data.seed(db)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/cities", response_model=List[schemas.City])
def list_cities():
    return [schemas.City(id=city_id, label=label) for city_id, label in seed_data.CITIES.items()]


@app.get("/api/business-types", response_model=List[schemas.BusinessType])
def list_business_types():
    return [
        schemas.BusinessType(id=type_id, name=spec["name"], icon=spec["icon"], description=spec["description"])
        for type_id, spec in BUSINESS_TYPES.items()
    ]


@app.get("/api/areas")
def list_areas(city: str = "hcm", db: Session = Depends(get_db)):
    """Returns a GeoJSON FeatureCollection: one polygon Feature per area,
    with the top-ranked business opportunity baked into `properties` so the
    map can choropleth-color each zone in a single request."""
    if city not in seed_data.CITIES:
        raise HTTPException(status_code=404, detail=f'Unknown city "{city}". Available: {list(seed_data.CITIES)}')
    areas = db.query(Area).filter(Area.city_id == city).all()
    features = []
    for area in areas:
        opportunities = score_area(area.metrics_dict(), area.competition())
        top = opportunities[0]
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": area.geometry()},
                "properties": {
                    "slug": area.slug,
                    "name": area.name,
                    "district": area.district,
                    "city": area.city,
                    "lat": area.lat,
                    "lng": area.lng,
                    "top_opportunity": {
                        "type_id": top.type_id,
                        "name": top.name,
                        "icon": top.icon,
                        "opportunity_score": top.opportunity_score,
                    },
                    "metrics": area.metrics_dict(),
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


@app.get("/api/areas/{slug}", response_model=schemas.AreaDetail)
def get_area(slug: str, db: Session = Depends(get_db)):
    area = db.query(Area).filter(Area.slug == slug).first()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")
    opportunities = score_area(area.metrics_dict(), area.competition())
    return schemas.AreaDetail(
        slug=area.slug,
        name=area.name,
        district=area.district,
        city=area.city,
        lat=area.lat,
        lng=area.lng,
        summary=area.summary,
        metrics=area.metrics_dict(),
        opportunities=[schemas.OpportunityOut(**vars(o)) for o in opportunities],
    )
