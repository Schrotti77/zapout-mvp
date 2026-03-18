from sqlalchemy import (
    Column, Integer, String, Float, 
    DateTime, ForeignKey, Enum
)
from sqlalchemy.sql import func
from app.database import Base

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Kern-Felder
    type = Column(
        Enum("send", "receive", name="tx_type"), 
        nullable=False
    )
    amount = Column(Integer, nullable=False)  # in Satoshis
    
    # Details
    recipient = Column(String(255), nullable=True)    # Lightning Address
    description = Column(String(500), nullable=True)  # Memo/Notiz
    payment_method = Column(
        Enum("lightning", "cashu", name="pay_method"),
        default="lightning"
    )
    
    # Status
    status = Column(
        Enum("pending", "completed", "failed", name="tx_status"),
        default="pending"
    )
    payment_hash = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)
    
    # Kategorisierung (Phase 2)
    category = Column(String(50), nullable=True)
    tags = Column(String(255), nullable=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "amount": self.amount,
            "recipient": self.recipient,
            "description": self.description,
            "payment_method": self.payment_method,
            "status": self.status,
            "category": self.category,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
