import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Garment(Base):
    __tablename__ = "garments"

    id = Column(String, primary_key=True, default=gen_uuid)
    sku = Column(String, nullable=False)
    product_name = Column(String, nullable=False)
    size = Column(String, nullable=False)
    manufactured_at = Column(DateTime, nullable=False)
    current_condition_score = Column(Integer, nullable=False, default=100)
    # active | returned | sanitizing | resale | retired
    current_status = Column(String, nullable=False, default="active")

    # Extra fields needed by the Marketplace / Dashboard, not in the original
    # spec's minimal field list but required by the API contract below.
    price = Column(Float, nullable=True)
    thumbnail_url = Column(String, nullable=True)

    cycles = relationship(
        "PassportCycle", back_populates="garment", order_by="PassportCycle.cycle_number"
    )
    rewards = relationship("Reward", back_populates="garment")


class PassportCycle(Base):
    __tablename__ = "passport_cycles"

    id = Column(String, primary_key=True, default=gen_uuid)
    garment_id = Column(String, ForeignKey("garments.id"), nullable=False)
    cycle_number = Column(Integer, nullable=False)
    # manufactured | purchased | returned | inspected | sanitized | resold
    event_type = Column(String, nullable=False)
    timestamp = Column(DateTime, nullable=False)
    condition_score_at_event = Column(Integer, nullable=True)
    notes = Column(String, nullable=True)

    garment = relationship("Garment", back_populates="cycles")
    rewards = relationship("Reward", back_populates="cycle")


class Reward(Base):
    __tablename__ = "rewards"

    id = Column(String, primary_key=True, default=gen_uuid)
    garment_id = Column(String, ForeignKey("garments.id"), nullable=False)
    cycle_id = Column(String, ForeignKey("passport_cycles.id"), nullable=False)
    reward_type = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    issued_at = Column(DateTime, nullable=False)

    garment = relationship("Garment", back_populates="rewards")
    cycle = relationship("PassportCycle", back_populates="rewards")
