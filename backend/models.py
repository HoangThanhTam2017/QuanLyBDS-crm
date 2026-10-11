from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    nhom: Mapped[str | None] = mapped_column(String(50), nullable=True)
    chuc_vu: Mapped[str | None] = mapped_column(String(50), nullable=True, default="nhân viên", server_default="nhân viên")
    trang_thai: Mapped[str] = mapped_column(String(50), nullable=False, default="Đang làm", server_default="Đang làm")

    properties: Mapped[list["Property"]] = relationship(back_populates="author")
    comments: Mapped[list["Comment"]] = relationship(back_populates="author")


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        "agent_id", ForeignKey("users.id"), nullable=True, index=True
    )
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    area: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    direction: Mapped[str | None] = mapped_column(String(50), nullable=True)
    so_to: Mapped[str | None] = mapped_column(String(50), nullable=True)
    so_thua: Mapped[str | None] = mapped_column(String(50), nullable=True)
    media_urls: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Chưa bán")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    author: Mapped[User | None] = relationship(back_populates="properties")
    comments: Mapped[list["Comment"]] = relationship(back_populates="listing", cascade="all, delete-orphan")


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    property_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now, index=True)

    listing: Mapped[Property] = relationship(back_populates="comments")
    author: Mapped[User | None] = relationship(back_populates="comments")


class PendingPost(Base):
    __tablename__ = "pending_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    employee_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    images: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now, index=True)

    author: Mapped[User | None] = relationship()


class LandPrice(Base):
    __tablename__ = "land_prices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    ma_phuong: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    duong: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    dat_o: Mapped[float | None] = mapped_column(Float, nullable=True)
    dat_tmdv: Mapped[float | None] = mapped_column(Float, nullable=True)
    dat_sxpnn: Mapped[float | None] = mapped_column(Float, nullable=True)


class BusinessContract(Base):
    __tablename__ = "business_contracts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    buyer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    seller_name: Mapped[str] = mapped_column(String(255), nullable=False)
    land_address: Mapped[str] = mapped_column(String(500), nullable=False)
    contract_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    commission: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    sale_price: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    lam_tu: Mapped[str] = mapped_column(String(50), nullable=False)
    nguon: Mapped[str] = mapped_column(String(50), nullable=False)
    deposit_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    ngay_thanh_toan: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Đặt cọc", index=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    nhom_phu_trach: Mapped[str | None] = mapped_column(String(100), nullable=True)
    user: Mapped["User | None"] = relationship()
