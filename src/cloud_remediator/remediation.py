"""Remediation engine — generates IaC and CLI remediation snippets."""
from __future__ import annotations
from typing import List
from .models import SecurityFinding


class RemediationEngine:
    """Generate remediation steps for a list of findings."""

    def generate_report(self, findings: List[SecurityFinding]) -> str:
        lines = [f"# Cloud Security Remediation Report", f"# {len(findings)} finding(s)\n"]
        for f in findings:
            lines += [
                f"## [{f.severity.name}] {f.rule_id}: {f.title}",
                f"Resource: {f.resource_id} ({f.resource_type.value})",
                f"Description: {f.description}",
                f"Remediation:",
                f"```bash",
                f"{f.remediation_template}",
                f"```",
                "",
            ]
        return "\n".join(lines)

    def generate_json(self, findings: List[SecurityFinding]) -> List[dict]:
        return [
            {
                "rule_id": f.rule_id,
                "resource_id": f.resource_id,
                "resource_type": f.resource_type.value,
                "severity": f.severity.name,
                "title": f.title,
                "description": f.description,
                "remediation": f.remediation_template,
                "risk_score": f.risk_score,
            }
            for f in findings
        ]
