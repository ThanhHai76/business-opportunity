from typing import List, Dict
from pydantic import BaseModel


class BusinessType(BaseModel):
    id: str
    name: str
    icon: str
    description: str


class OpportunityOut(BaseModel):
    type_id: str
    name: str
    icon: str
    description: str
    demand_score: float
    competition_index: float
    opportunity_score: float
    top_drivers: List[str]


class City(BaseModel):
    id: str
    label: str


class AreaSummary(BaseModel):
    slug: str
    name: str
    district: str
    city: str
    lat: float
    lng: float
    top_opportunity: OpportunityOut
    metrics: Dict[str, float]


class AreaDetail(BaseModel):
    slug: str
    name: str
    district: str
    city: str
    lat: float
    lng: float
    summary: str
    metrics: Dict[str, float]
    opportunities: List[OpportunityOut]
