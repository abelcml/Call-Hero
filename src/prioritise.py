from __future__ import annotations

from typing import Any, Dict


PRIORITY_POINTS = {
    "urgent": 100,
    "high": 60,
    "medium": 30,
    "low": 10,
}


def score_call(call: Dict[str, Any]) -> int:
    """Simple, explainable baseline. Replace with JEV/LLM later if useful."""
    score = PRIORITY_POINTS.get(call.get("priority", "low").lower(), 10)

    if call.get("requires_human"):
        score += 25
    if not call.get("resolved"):
        score += 20
    if call.get("booking_risk"):
        score += 15
    if call.get("today_relevant"):
        score += 20

    return score


def action_label(call: Dict[str, Any]) -> str:
    if call.get("resolved"):
        return "Resolved"
    if call.get("suggested_action"):
        return call["suggested_action"]
    return "Review"


def owner_visible(call: Dict[str, Any]) -> bool:
    """Keep the 90-second screen focused on unresolved, human-relevant work."""
    return (
        not call.get("resolved", False)
        or call.get("requires_human", False)
        or call.get("today_relevant", False)
    )
