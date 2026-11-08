"""Conservative, regex-only section/clause heading detection. Returns a title only when confident."""
from __future__ import annotations

import re

_KEYWORD = re.compile(r"^(?:article|clause|section|schedule|annex(?:ure)?|appendix|conditions?(?: of contract)?|special provisions)\b[^\n]{0,110}$", re.IGNORECASE)
_NUMBERED = re.compile(r"^\d{1,2}(?:\.\d{1,2}){0,3}[.)]?\s+[A-Z඀-෿஀-௿][^\n]{1,78}$")
_MARKDOWN = re.compile(r"^#{1,6}\s+\S[^\n]{0,150}$")
_LEAD_IN = re.compile(r"^\([a-z]\)\s")


def heading_title(line: str) -> str | None:
    s = line.strip()
    if not s or len(s) > 160:
        return None
    if _MARKDOWN.match(s):
        return s.lstrip("#").strip()[:160]
    if _LEAD_IN.match(s):
        return None  # (a) lead-ins are body text, not headings
    if _KEYWORD.match(s) and len(s) <= 120 and not s.endswith(","):
        return s[:160]
    if _NUMBERED.match(s) and not s.endswith((".", ",", ";", ":")):
        return s[:160]
    letters = [c for c in s if c.isalpha()]
    if 3 <= len(s) <= 80 and len(letters) >= 3 and s == s.upper() and any("A" <= c <= "Z" for c in s) and not s.endswith((".", ",")):
        return s[:160]
    return None
