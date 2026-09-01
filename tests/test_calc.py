from decimal import Decimal

import pytest

from salary_note.calc import compute_payroll, compute_teacher
from salary_note.models import Payroll, Period, Teacher, round_half_up
from salary_note.numerals import to_chinese_upper


# ---------- Period ----------

def test_period_partial_labels():
    p = Period(roc_year=115, month=8, start_day=16)
    assert p.ad_year == 2026
    assert p.days_in_month == 31
    assert p.days == 16
    assert p.is_partial
    assert p.label_zh == "115年08月份"
    assert p.label_en == "August 16-31, 2026"
    assert p.ratio_label == "16/31"
    assert p.insurance_ratio_label == "16/30"
    assert p.file_tag == "115.08"


def test_period_full_month_labels():
    p = Period(roc_year=115, month=9)
    assert not p.is_partial
    assert p.days == 30
    assert p.label_en == "September 2026"


def test_period_validation():
    with pytest.raises(ValueError):
        Period(roc_year=115, month=2, end_day=30)
    with pytest.raises(ValueError):
        Period(roc_year=115, month=8, start_day=20, end_day=10)


def test_prorate_matches_school_sheet():
    """115.08 的數字就是 115.09 全月數字按 16/31、16/30 換算來的。"""
    p = Period(roc_year=115, month=8, start_day=16)
    assert p.prorate(80750) == 41677
    assert p.prorate(5000) == 2581
    assert p.prorate(1000) == 516
    assert p.prorate_insurance(4095) == 2184
    assert p.prorate_insurance(5256) == 2803


def test_round_half_up():
    assert round_half_up(2.5) == 3
    assert round_half_up(2580.645) == 2581
    assert round_half_up(516.13) == 516


# ---------- 計算 ----------

def test_teacher_calc_0808(payroll_0808: Payroll):
    calc = compute_payroll(payroll_0808)
    t = calc.teachers[0]
    assert t.subtotal == 44774
    assert t.gross == 54000
    assert t.tax == 2212  # ROUNDDOWN(44258*0.05)=2212.9 → 2212
    assert t.deductions == 4187
    assert t.net == 40587
    assert t.net_with_extras == 42523  # 通知單實發
    assert calc.total_gross == 55936
    assert calc.total_net == 42523
    assert calc.total_gross_upper == "伍萬伍仟玖佰參拾陸"
    assert calc.common_tax_rate_pct == Decimal("5")


def test_teacher_calc_0809(payroll_0809: Payroll):
    calc = compute_payroll(payroll_0809)
    t = calc.teachers[0]
    assert t.subtotal == 86750
    assert t.gross == 100340
    assert t.tax == 4287
    assert t.deductions == 6791
    assert t.net == 79959
    assert calc.total_gross == 100340
    assert calc.total_gross_upper == "壹拾萬零參佰肆拾"


def test_prorate_flag_converts_full_month_input():
    """輸入全月金額 + prorate=True，應得到 115.08 原表的數字。"""
    p = Payroll(
        period=Period(roc_year=115, month=8, start_day=16),
        prorate=True,
        teachers=[Teacher(
            name="X", salary=80750, housing=5000, transport=1000,
            labor_ins_employer=4095, health_ins_employer=4239, pension_employer=5256,
            labor_ins_self=1155, health_ins_self=1359,
        )],
    )
    t = compute_payroll(p).teachers[0]
    assert (t.salary, t.housing, t.transport) == (41677, 2581, 516)
    assert (t.labor_ins_employer, t.pension_employer, t.labor_ins_self) == (2184, 2803, 616)
    assert t.health_ins_employer == 4239 and t.health_ins_self == 1359  # 健保不換算


def test_prorate_flag_ignored_on_full_month():
    t = compute_teacher(Teacher(name="X", salary=80750), Period(roc_year=115, month=9), prorate=True)
    assert t.salary == 80750


def test_leave_deduction_subtracts():
    t = compute_teacher(
        Teacher(name="X", salary=1000, housing=100, transport=10, leave_deduction=200),
        Period(roc_year=115, month=9), prorate=False,
    )
    assert t.subtotal == 910


def test_mixed_tax_rates_have_no_common_rate():
    p = Payroll(
        period=Period(roc_year=115, month=9),
        teachers=[
            Teacher(name="A", salary=1000, tax_rate_pct=5),
            Teacher(name="B", salary=1000, tax_rate_pct=18),
        ],
    )
    calc = compute_payroll(p)
    assert calc.common_tax_rate_pct is None
    assert calc.teachers[1].tax == 180


# ---------- 大寫 ----------

@pytest.mark.parametrize("n, expected", [
    (0, "零"),
    (5, "伍"),
    (10, "壹拾"),
    (1000, "壹仟"),
    (1005, "壹仟零伍"),
    (1050, "壹仟零伍拾"),
    (10005, "壹萬零伍"),
    (55936, "伍萬伍仟玖佰參拾陸"),
    (100340, "壹拾萬零參佰肆拾"),
    (1000000, "壹佰萬"),
    (100000340, "壹億零參佰肆拾"),
    (100001340, "壹億零壹仟參佰肆拾"),
    (120000000, "壹億貳仟萬"),
])
def test_chinese_upper(n, expected):
    assert to_chinese_upper(n) == expected
