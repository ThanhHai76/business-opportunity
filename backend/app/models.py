"""ORM models.

An Area represents a zone on the map (district / ward / custom polygon).
Its "growth metrics" (0-100 index) drive the opportunity scoring engine in
scoring.py. Competition (saturation) per business type is stored as JSON so
the seed data can tell a believable story per district without needing a
separate table for the MVP.
"""
import json
from sqlalchemy import Column, Integer, String, Float, Text
from .database import Base


class Area(Base):
    __tablename__ = "areas"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    district = Column(String, nullable=False)
    city_id = Column(String, nullable=False, default="hcm", index=True)  # 'hcm' | 'hanoi'
    city = Column(String, nullable=False, default="TP. Hồ Chí Minh")  # display label
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)

    # GeoJSON polygon coordinates, stored as JSON text: [[[lng, lat], ...]]
    geometry_json = Column(Text, nullable=False)

    # Growth indices, 0-100 (higher = growing faster / more favorable)
    population_growth = Column(Float, nullable=False)
    metro_growth = Column(Float, nullable=False)
    apartment_growth = Column(Float, nullable=False)
    school_growth = Column(Float, nullable=False)
    office_growth = Column(Float, nullable=False)

    # Free-text narrative shown in the area detail panel
    summary = Column(Text, nullable=False, default="")

    # Per-business-type competition/saturation index (0-100), JSON text:
    # {"cafe": 40, "fnb": 55, ...}
    competition_json = Column(Text, nullable=False, default="{}")

    def geometry(self):
        return json.loads(self.geometry_json)

    def competition(self):
        return json.loads(self.competition_json)

    def metrics_dict(self):
        return {
            "population_growth": self.population_growth,
            "metro_growth": self.metro_growth,
            "apartment_growth": self.apartment_growth,
            "school_growth": self.school_growth,
            "office_growth": self.office_growth,
        }
