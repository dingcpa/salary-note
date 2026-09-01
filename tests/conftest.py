"""共用測試資料：115.08 樣本（8/16–8/31 不足月、含健康檢查費用）與 115.09 全月樣本。"""

import pytest

from salary_note.models import Payroll, Period, Teacher

# 原表 115.08 工作表的實際數字
SAMPLE_0808 = dict(
    name="Sample Teacher",
    grade=8,
    contract="115/8/16-116/7/15",
    salary=41677,
    housing=2581,
    transport=516,
    leave_deduction=0,
    labor_ins_employer=2184,
    health_ins_employer=4239,
    pension_employer=2803,
    labor_ins_self=616,
    health_ins_self=1359,
    tax_rate_pct=5,
    health_check=1936,
)

# 原表 115.09 工作表（全月）
SAMPLE_0809 = dict(
    name="Sample Teacher",
    grade=8,
    contract="115/8/16-116/7/15",
    salary=80750,
    housing=5000,
    transport=1000,
    leave_deduction=0,
    labor_ins_employer=4095,
    health_ins_employer=4239,
    pension_employer=5256,
    labor_ins_self=1145,
    health_ins_self=1359,
    tax_rate_pct=5,
    health_check=0,
)


@pytest.fixture
def payroll_0808() -> Payroll:
    return Payroll(
        period=Period(roc_year=115, month=8, start_day=16),
        teachers=[Teacher(**SAMPLE_0808)],
    )


@pytest.fixture
def payroll_0809() -> Payroll:
    return Payroll(
        period=Period(roc_year=115, month=9),
        teachers=[Teacher(**SAMPLE_0809)],
    )
