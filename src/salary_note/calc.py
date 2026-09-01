"""薪資計算：把輸入模型算成清冊／通知單要用的所有數字。

規則沿用學校原表（見 CLAUDE.md）。這裡算出的值同時用來寫 xlsx 的公式驗證與通知單的靜態數字。
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from .models import Payroll, Period, Teacher
from .numerals import to_chinese_upper


@dataclass(frozen=True)
class TeacherCalc:
    teacher: Teacher
    # 換算後（不足月且 prorate 時）實際入表的金額
    salary: int
    housing: int
    transport: int
    leave_deduction: int
    labor_ins_employer: int
    health_ins_employer: int
    pension_employer: int
    labor_ins_self: int
    health_ins_self: int
    tax_rate: Decimal  # 0.05
    health_check: int

    @property
    def name(self) -> str:
        return self.teacher.name

    @property
    def subtotal(self) -> int:
        """小計 G = C + D + E − F"""
        return self.salary + self.housing + self.transport - self.leave_deduction

    @property
    def gross(self) -> int:
        """應發金額 K = 小計 + 勞保機補 + 健保機補 + 勞退機補"""
        return self.subtotal + self.labor_ins_employer + self.health_ins_employer + self.pension_employer

    @property
    def tax(self) -> int:
        """預扣稅額 L = ROUNDDOWN((薪資 + 住宿) × 稅率, 0)"""
        return int(Decimal(self.salary + self.housing) * self.tax_rate)

    @property
    def deductions(self) -> int:
        """代扣款小計 O = 預扣稅額 + 勞保自付 + 健保自付"""
        return self.tax + self.labor_ins_self + self.health_ins_self

    @property
    def net(self) -> int:
        """實領金額 P = 小計 − 代扣款小計"""
        return self.subtotal - self.deductions

    @property
    def gross_with_extras(self) -> int:
        """本人在清冊上的應發合計（含健康檢查費用）"""
        return self.gross + self.health_check

    @property
    def net_with_extras(self) -> int:
        """本人在清冊上的實領合計（含健康檢查費用）＝通知單的實發金額"""
        return self.net + self.health_check

    @property
    def remark(self) -> str:
        return f"聘期\n{self.teacher.contract}" if self.teacher.contract else ""


@dataclass(frozen=True)
class PayrollCalc:
    payroll: Payroll
    teachers: list[TeacherCalc]

    @property
    def period(self) -> Period:
        return self.payroll.period

    @property
    def total_gross(self) -> int:
        return sum(t.gross_with_extras for t in self.teachers)

    @property
    def total_net(self) -> int:
        return sum(t.net_with_extras for t in self.teachers)

    @property
    def total_gross_upper(self) -> str:
        return to_chinese_upper(self.total_gross)

    @property
    def common_tax_rate_pct(self) -> Decimal | None:
        """所有外師稅率相同時回傳該稅率（%），否則 None（表頭就不標百分比）。"""
        rates = {t.teacher.tax_rate_pct for t in self.teachers}
        return rates.pop() if len(rates) == 1 else None


def compute_teacher(t: Teacher, period: Period, prorate: bool) -> TeacherCalc:
    do_prorate = prorate and period.is_partial
    pay = period.prorate if do_prorate else (lambda x: x)
    ins = period.prorate_insurance if do_prorate else (lambda x: x)
    return TeacherCalc(
        teacher=t,
        salary=pay(t.salary),
        housing=pay(t.housing),
        transport=pay(t.transport),
        leave_deduction=t.leave_deduction,
        labor_ins_employer=ins(t.labor_ins_employer),
        health_ins_employer=t.health_ins_employer,
        pension_employer=ins(t.pension_employer),
        labor_ins_self=ins(t.labor_ins_self),
        health_ins_self=t.health_ins_self,
        tax_rate=Decimal(t.tax_rate_pct) / 100,
        health_check=t.health_check,
    )


def compute_payroll(p: Payroll) -> PayrollCalc:
    return PayrollCalc(
        payroll=p,
        teachers=[compute_teacher(t, p.period, p.prorate) for t in p.teachers],
    )
