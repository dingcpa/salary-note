"""金額中文大寫（對應 Excel [DBNum2] 格式：壹貳參肆伍陸柒捌玖拾佰仟萬億）。"""

DIGITS = "零壹貳參肆伍陸柒捌玖"
UNITS = ["", "拾", "佰", "仟"]
BIG_UNITS = ["", "萬", "億", "兆"]


def _group(g: int) -> str:
    """0 < g < 10000 的四位數轉大寫，中間的零只寫一次、尾端的零不寫。"""
    out = ""
    started = False
    pending_zero = False
    for pos in (3, 2, 1, 0):
        d = (g // 10**pos) % 10
        if d == 0:
            if started:
                pending_zero = True
            continue
        if pending_zero:
            out += "零"
            pending_zero = False
        out += DIGITS[d] + UNITS[pos]
        started = True
    return out


def to_chinese_upper(n: int) -> str:
    """整數轉中文大寫，例：55936 → 伍萬伍仟玖佰參拾陸；100340 → 壹拾萬零參佰肆拾。"""
    if n < 0:
        return "負" + to_chinese_upper(-n)
    if n == 0:
        return "零"
    groups: list[int] = []
    m = n
    while m:
        groups.append(m % 10000)
        m //= 10000
    top = len(groups) - 1
    out = ""
    gap = False  # 前面是否有整組為零被略過
    for gi in range(top, -1, -1):
        g = groups[gi]
        if g == 0:
            if gi < top:
                gap = True
            continue
        part = _group(g)
        if gi < top and (gap or g < 1000):
            part = "零" + part
        gap = False
        out += part + BIG_UNITS[gi]
    return out
