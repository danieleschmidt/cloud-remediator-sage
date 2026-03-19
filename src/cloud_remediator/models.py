"""Data models for cloud security findings."""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


class Severity(Enum):
    CRITICAL = 4
    HIGH = 3
    MEDIUM = 2
    LOW = 1
    INFO = 0

    def __lt__(self, other): return self.value < other.value
    def __le__(self, other): return self.value <= other.value


class ResourceType(Enum):
    S3_BUCKET = "s3_bucket"
    SECURITY_GROUP = "security_group"
    IAM_ROLE = "iam_role"
    IAM_USER = "iam_user"
    RDS_INSTANCE = "rds_instance"
    EC2_INSTANCE = "ec2_instance"
    EBS_VOLUME = "ebs_volume"
    CLOUDTRAIL = "cloudtrail"
    KMS_KEY = "kms_key"
    LAMBDA_FUNCTION = "lambda_function"
    UNKNOWN = "unknown"


@dataclass
class SecurityFinding:
    rule_id: str
    resource_id: str
    resource_type: ResourceType
    severity: Severity
    title: str
    description: str
    remediation_template: str
    tags: Dict[str, str] = field(default_factory=dict)
    region: str = "us-east-1"

    @property
    def risk_score(self) -> int:
        return self.severity.value * 25

    def __repr__(self) -> str:
        return f"[{self.severity.name}] {self.rule_id}: {self.resource_id}"
