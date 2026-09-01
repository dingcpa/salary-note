"""輸入資料模型：給薪期間、外師薪資項目、整份薪資單。"""

from __future__ import annotations

import calendar
from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel, Field, field_validator, model_validator

MONTH_EN = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

INSURANCE_DAY_BASE = 30  # 勞保／勞退以 30 天為一個月


def round_half_up(x: float | Decimal) -> int:
    """四捨五入到整數（Python 內建 round 是銀行家捨入，這裡要一般的四捨五入）。"""
    return int(Decimal(str(x)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


class Period(BaseModel):
    """給薪期間（民國年月，可指定不足月的起迄日）。"""

    roc_year: int = Field(ge=100, le=200, description="民國年")
    month: int = Field(ge=1, le=12)
    start_day: int = Field(default=1, ge=1, le=31)
    end_day: int | None = Field(default=None, ge=1, le=31, description="留空 = 月底")

    @property
    def ad_year(self) -> int:
        return self.roc_year + 1911

    @property
    def days_in_month(self) -> int:
        return calendar.monthrange(self.ad_year, self.month)[1]

    @property
    def last_day(self) -> int:
        return self.end_day or self.days_in_month

    @property
    def days(self) -> int:
        return self.last_day - self.start_day + 1

    @property
    def is_partial(self) -> bool:
        return self.start_day != 1 or self.last_day != self.days_in_month

    @property
    def label_zh(self) -> str:
        """例：115年08月份"""
        return f"{self.roc_year}年{self.month:02d}月份"

    @property
    def label_en(self) -> str:
        """例：August 16-31, 2026 ／ September 2026"""
        name = MONTH_EN[self.month - 1]
        if self.is_partial:
            return f"{name} {self.start_day}-{self.last_day}, {self.ad_year}"
        return f"{name} {self.ad_year}"

    @property
    def file_tag(self) -> str:
        """例：115.08"""
        return f"{self.roc_year}.{self.month:02d}"

    @property
    def ratio_label(self) -> str:
        """薪資類欄位表頭註記，例：16/31"""
        return f"{self.days}/{self.days_in_month}"

    @property
    def insurance_ratio_label(self) -> str:
        """勞保／勞退欄位表頭註記，例：16/30"""
        return f"{self.days}/{INSURANCE_DAY_BASE}"

    def prorate(self, amount: int) -> int:
        """薪資類：全月金額 × 天數 / 當月天數"""
        return round_half_up(Decimal(amount) * self.days / self.days_in_month)

    def prorate_insurance(self, amount: int) -> int:
        """勞保／勞退類：全月金額 × 天數 / 30"""
        return round_half_up(Decimal(amount) * self.days / INSURANCE_DAY_BASE)

    @model_validator(mode="after")
    def _check_days(self) -> "Period":
        dim = self.days_in_month
        if self.end_day is not None and self.end_day > dim:
            raise ValueError(f"迄日 {self.end_day} 超過當月天數 {dim}")
        if self.start_day > self.last_day:
            raise ValueError("起日不可晚於迄日")
        return self


class Teacher(BaseModel):
    """一位外師的薪資項目（金額皆為新臺幣整數）。"""

    name: str = Field(min_length=1)
    grade: int | None = Field(default=None, description="薪級")
    contract: str = Field(default="", description="聘期，例 115/8/16-116/7/15")
    office: str = "Academic Affairs Office"
    job_title: str = "Teacher"

    salary: int = Field(ge=0, description="本月薪資")
    housing: int = Field(default=0, ge=0, description="住宿津貼")
    transport: int = Field(default=0, ge=0, description="交通費")
    leave_deduction: int = Field(default=0, ge=0, description="請假扣薪（正數）")
    labor_ins_employer: int = Field(default=0, ge=0, description="勞保機補")
    health_ins_employer: int = Field(default=0, ge=0, description="健保機補")
    pension_employer: int = Field(default=0, ge=0, description="勞退機補")
    labor_ins_self: int = Field(default=0, ge=0, description="勞保自付")
    health_ins_self: int = Field(default=0, ge=0, description="健保自付")
    tax_rate_pct: Decimal = Field(default=Decimal("5"), ge=0, le=100, description="預扣稅率 %")
    health_check: int = Field(default=0, ge=0, description="健康檢查費用（另列一行）")

    @field_validator("name", "contract", "office", "job_title")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class Payroll(BaseModel):
    """一整份薪資單的輸入。"""

    period: Period
    teachers: list[Teacher] = Field(min_length=1)
    school_name: str = "嘉義市立嘉義國民中學"
    roster_title_suffix: str = "外籍英語教師薪資印領清冊"
    statement_title_zh: str = "嘉義市嘉義國中外籍教師鐘點通知單"
    statement_title_en: str = "CYJH Salary Statement"
    prorate: bool = Field(
        default=False,
        description="True 時視輸入金額為全月金額，依期間天數自動換算（僅不足月時生效）",
    )

    @property
    def roster_title(self) -> str:
        return f"{self.school_name}{self.period.label_zh}{self.roster_title_suffix}"
