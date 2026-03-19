"""Priority graph for ordered remediation using topological sort."""
from __future__ import annotations
from typing import Dict, List, Set
from .models import SecurityFinding


# Remediation dependencies: fix these rules before those
DEPENDENCIES: Dict[str, List[str]] = {
    "S3-001": ["IAM-003"],   # public bucket risk higher if IAM is also permissive
    "RDS-001": ["SG-001"],   # exposed DB + open SG = double exposure
    "IAM-003": [],
    "IAM-001": [],
    "CT-001": [],
}


class PriorityGraph:
    """Topological sort of remediation findings by dependencies + severity."""

    def __init__(self, findings: List[SecurityFinding]):
        self.findings = findings
        self._by_rule: Dict[str, List[SecurityFinding]] = {}
        for f in findings:
            self._by_rule.setdefault(f.rule_id, []).append(f)

    def ordered_plan(self) -> List[SecurityFinding]:
        """Return findings in suggested remediation order."""
        visited: Set[str] = set()
        order: List[SecurityFinding] = []

        def visit(rule_id: str):
            if rule_id in visited:
                return
            visited.add(rule_id)
            for dep in DEPENDENCIES.get(rule_id, []):
                visit(dep)
            for f in self._by_rule.get(rule_id, []):
                order.append(f)

        # Visit all rules in severity order (highest first)
        for f in sorted(self.findings, key=lambda x: x.severity.value, reverse=True):
            visit(f.rule_id)

        return order

    def summary(self) -> Dict[str, int]:
        from .models import Severity
        return {s.name: sum(1 for f in self.findings if f.severity == s) for s in Severity}
