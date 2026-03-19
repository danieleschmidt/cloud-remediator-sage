"""
Security scanner — checks cloud config against 16 security rules.

Input: dict representation of cloud resources (AWS-style).
Output: list of SecurityFinding.
"""
from __future__ import annotations
from typing import Any, Dict, List
from .models import SecurityFinding, Severity, ResourceType


class SecurityScanner:
    """
    Scans a cloud configuration dict and returns security findings.

    Config format:
        {
            "s3_buckets": [{"id": "my-bucket", "public": True, "encrypted": False, ...}],
            "security_groups": [{"id": "sg-123", "rules": [{"cidr": "0.0.0.0/0", "port": 22}]}],
            "iam_users": [{"id": "alice", "mfa_enabled": False, "access_keys": [...]}],
            ...
        }
    """

    def scan(self, config: Dict[str, Any]) -> List[SecurityFinding]:
        findings: List[SecurityFinding] = []
        findings += self._check_s3(config.get("s3_buckets", []))
        findings += self._check_security_groups(config.get("security_groups", []))
        findings += self._check_iam_users(config.get("iam_users", []))
        findings += self._check_iam_roles(config.get("iam_roles", []))
        findings += self._check_rds(config.get("rds_instances", []))
        findings += self._check_ebs(config.get("ebs_volumes", []))
        findings += self._check_cloudtrail(config.get("cloudtrail", {}))
        findings += self._check_ec2(config.get("ec2_instances", []))
        return sorted(findings, key=lambda f: f.severity.value, reverse=True)

    # ── S3 ────────────────────────────────────────────────────────────────────

    def _check_s3(self, buckets: list) -> List[SecurityFinding]:
        findings = []
        for b in buckets:
            bid = b.get("id", "unknown")
            if b.get("public", False):
                findings.append(SecurityFinding(
                    rule_id="S3-001",
                    resource_id=bid,
                    resource_type=ResourceType.S3_BUCKET,
                    severity=Severity.CRITICAL,
                    title="S3 Bucket Publicly Accessible",
                    description=f"Bucket '{bid}' has public access enabled.",
                    remediation_template=(
                        f'aws s3api put-public-access-block --bucket {bid} '
                        f'--public-access-block-configuration BlockPublicAcls=true,'
                        f'IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'
                    ),
                ))
            if not b.get("encrypted", True):
                findings.append(SecurityFinding(
                    rule_id="S3-002",
                    resource_id=bid,
                    resource_type=ResourceType.S3_BUCKET,
                    severity=Severity.HIGH,
                    title="S3 Bucket Not Encrypted",
                    description=f"Bucket '{bid}' lacks server-side encryption.",
                    remediation_template=(
                        f'aws s3api put-bucket-encryption --bucket {bid} '
                        'aws s3api put-bucket-encryption --bucket ' + bid + ' --server-side-encryption-configuration {Rules:[{SSEAlgorithm:AES256}]}',
                    ),
                ))
            if not b.get("versioning_enabled", True):
                findings.append(SecurityFinding(
                    rule_id="S3-003",
                    resource_id=bid,
                    resource_type=ResourceType.S3_BUCKET,
                    severity=Severity.MEDIUM,
                    title="S3 Bucket Versioning Disabled",
                    description=f"Bucket '{bid}' has versioning disabled.",
                    remediation_template=f'aws s3api put-bucket-versioning --bucket {bid} --versioning-configuration Status=Enabled',
                ))
            if not b.get("logging_enabled", True):
                findings.append(SecurityFinding(
                    rule_id="S3-004",
                    resource_id=bid,
                    resource_type=ResourceType.S3_BUCKET,
                    severity=Severity.LOW,
                    title="S3 Bucket Access Logging Disabled",
                    description=f"Bucket '{bid}' does not log access requests.",
                    remediation_template=f'aws s3api put-bucket-logging --bucket {bid} --bucket-logging-status {{"LoggingEnabled":{{"TargetBucket":"{bid}-logs","TargetPrefix":"access/"}}}}',
                ))
        return findings

    # ── Security Groups ───────────────────────────────────────────────────────

    def _check_security_groups(self, sgs: list) -> List[SecurityFinding]:
        findings = []
        DANGEROUS_PORTS = {22: "SSH", 3389: "RDP", 3306: "MySQL", 5432: "PostgreSQL", 27017: "MongoDB"}
        OPEN_CIDRS = {"0.0.0.0/0", "::/0"}
        for sg in sgs:
            sgid = sg.get("id", "unknown")
            for rule in sg.get("rules", []):
                cidr = rule.get("cidr", "")
                port = rule.get("port")
                if cidr in OPEN_CIDRS and port in DANGEROUS_PORTS:
                    findings.append(SecurityFinding(
                        rule_id="SG-001",
                        resource_id=sgid,
                        resource_type=ResourceType.SECURITY_GROUP,
                        severity=Severity.CRITICAL,
                        title=f"Security Group Exposes {DANGEROUS_PORTS[port]} to Internet",
                        description=f"SG '{sgid}' allows {DANGEROUS_PORTS[port]} (port {port}) from {cidr}.",
                        remediation_template=f'aws ec2 revoke-security-group-ingress --group-id {sgid} --protocol tcp --port {port} --cidr {cidr}',
                    ))
                elif cidr in OPEN_CIDRS and rule.get("all_traffic", False):
                    findings.append(SecurityFinding(
                        rule_id="SG-002",
                        resource_id=sgid,
                        resource_type=ResourceType.SECURITY_GROUP,
                        severity=Severity.HIGH,
                        title="Security Group Allows All Traffic from Internet",
                        description=f"SG '{sgid}' allows all inbound traffic from {cidr}.",
                        remediation_template=f'aws ec2 revoke-security-group-ingress --group-id {sgid} --protocol all --cidr {cidr}',
                    ))
        return findings

    # ── IAM Users ─────────────────────────────────────────────────────────────

    def _check_iam_users(self, users: list) -> List[SecurityFinding]:
        findings = []
        for u in users:
            uid = u.get("id", "unknown")
            if not u.get("mfa_enabled", True):
                findings.append(SecurityFinding(
                    rule_id="IAM-001",
                    resource_id=uid,
                    resource_type=ResourceType.IAM_USER,
                    severity=Severity.HIGH,
                    title="IAM User Without MFA",
                    description=f"User '{uid}' does not have MFA enabled.",
                    remediation_template=f'aws iam enable-mfa-device --user-name {uid} --serial-number arn:aws:iam::ACCOUNT:mfa/{uid} --authentication-code1 CODE1 --authentication-code2 CODE2',
                ))
            for key in u.get("access_keys", []):
                if key.get("age_days", 0) > 90:
                    findings.append(SecurityFinding(
                        rule_id="IAM-002",
                        resource_id=uid,
                        resource_type=ResourceType.IAM_USER,
                        severity=Severity.MEDIUM,
                        title="IAM Access Key Older Than 90 Days",
                        description=f"User '{uid}' has an access key {key.get('age_days')} days old.",
                        remediation_template=f'aws iam delete-access-key --user-name {uid} --access-key-id {key.get("id", "KEY_ID")}',
                    ))
        return findings

    # ── IAM Roles ─────────────────────────────────────────────────────────────

    def _check_iam_roles(self, roles: list) -> List[SecurityFinding]:
        findings = []
        for r in roles:
            rid = r.get("id", "unknown")
            policy = r.get("policy", {})
            if policy.get("effect") == "Allow" and policy.get("action") == "*" and policy.get("resource") == "*":
                findings.append(SecurityFinding(
                    rule_id="IAM-003",
                    resource_id=rid,
                    resource_type=ResourceType.IAM_ROLE,
                    severity=Severity.CRITICAL,
                    title="IAM Role With Wildcard Permissions",
                    description=f"Role '{rid}' has Allow:*:* policy (full access).",
                    remediation_template=f'# Restrict role {rid}: replace wildcard policy with least-privilege policy\naws iam put-role-policy --role-name {rid} --policy-name least-privilege --policy-document file://least-privilege-policy.json',
                ))
        return findings

    # ── RDS ───────────────────────────────────────────────────────────────────

    def _check_rds(self, instances: list) -> List[SecurityFinding]:
        findings = []
        for db in instances:
            did = db.get("id", "unknown")
            if db.get("publicly_accessible", False):
                findings.append(SecurityFinding(
                    rule_id="RDS-001",
                    resource_id=did,
                    resource_type=ResourceType.RDS_INSTANCE,
                    severity=Severity.CRITICAL,
                    title="RDS Instance Publicly Accessible",
                    description=f"DB '{did}' is exposed to the internet.",
                    remediation_template=f'aws rds modify-db-instance --db-instance-identifier {did} --no-publicly-accessible --apply-immediately',
                ))
            if not db.get("encrypted", True):
                findings.append(SecurityFinding(
                    rule_id="RDS-002",
                    resource_id=did,
                    resource_type=ResourceType.RDS_INSTANCE,
                    severity=Severity.HIGH,
                    title="RDS Instance Not Encrypted at Rest",
                    description=f"DB '{did}' storage is not encrypted.",
                    remediation_template=f'# Encryption must be enabled at creation. Snapshot and restore:\naws rds create-db-snapshot --db-instance-identifier {did} --db-snapshot-identifier {did}-snapshot\n# Then restore encrypted copy',
                ))
            if not db.get("backup_enabled", True):
                findings.append(SecurityFinding(
                    rule_id="RDS-003",
                    resource_id=did,
                    resource_type=ResourceType.RDS_INSTANCE,
                    severity=Severity.MEDIUM,
                    title="RDS Automated Backups Disabled",
                    description=f"DB '{did}' has no automated backups.",
                    remediation_template=f'aws rds modify-db-instance --db-instance-identifier {did} --backup-retention-period 7 --apply-immediately',
                ))
        return findings

    # ── EBS ───────────────────────────────────────────────────────────────────

    def _check_ebs(self, volumes: list) -> List[SecurityFinding]:
        findings = []
        for v in volumes:
            vid = v.get("id", "unknown")
            if not v.get("encrypted", True):
                findings.append(SecurityFinding(
                    rule_id="EBS-001",
                    resource_id=vid,
                    resource_type=ResourceType.EBS_VOLUME,
                    severity=Severity.HIGH,
                    title="EBS Volume Not Encrypted",
                    description=f"Volume '{vid}' is unencrypted.",
                    remediation_template=f'# Create encrypted snapshot and new volume:\naws ec2 create-snapshot --volume-id {vid} --description "pre-encrypt"\n# Then copy snapshot with encryption enabled',
                ))
        return findings

    # ── CloudTrail ────────────────────────────────────────────────────────────

    def _check_cloudtrail(self, ct: dict) -> List[SecurityFinding]:
        findings = []
        if not ct.get("enabled", True):
            findings.append(SecurityFinding(
                rule_id="CT-001",
                resource_id="cloudtrail",
                resource_type=ResourceType.CLOUDTRAIL,
                severity=Severity.CRITICAL,
                title="CloudTrail Not Enabled",
                description="No CloudTrail trail is active — API activity is unlogged.",
                remediation_template='aws cloudtrail create-trail --name management-events --s3-bucket-name cloudtrail-logs-ACCOUNT && aws cloudtrail start-logging --name management-events',
            ))
        elif not ct.get("multi_region", False):
            findings.append(SecurityFinding(
                rule_id="CT-002",
                resource_id="cloudtrail",
                resource_type=ResourceType.CLOUDTRAIL,
                severity=Severity.MEDIUM,
                title="CloudTrail Not Multi-Region",
                description="CloudTrail only logs one region — cross-region activity is invisible.",
                remediation_template='aws cloudtrail update-trail --name management-events --is-multi-region-trail',
            ))
        return findings

    # ── EC2 ───────────────────────────────────────────────────────────────────

    def _check_ec2(self, instances: list) -> List[SecurityFinding]:
        findings = []
        for ec2 in instances:
            iid = ec2.get("id", "unknown")
            if ec2.get("imdsv1_enabled", False):
                findings.append(SecurityFinding(
                    rule_id="EC2-001",
                    resource_id=iid,
                    resource_type=ResourceType.EC2_INSTANCE,
                    severity=Severity.MEDIUM,
                    title="EC2 IMDSv1 Enabled (SSRF Risk)",
                    description=f"Instance '{iid}' allows IMDSv1, enabling SSRF credential theft.",
                    remediation_template=f'aws ec2 modify-instance-metadata-options --instance-id {iid} --http-tokens required --http-endpoint enabled',
                ))
            if not ec2.get("ebs_optimized", True) and ec2.get("instance_type", "").startswith("m5"):
                findings.append(SecurityFinding(
                    rule_id="EC2-002",
                    resource_id=iid,
                    resource_type=ResourceType.EC2_INSTANCE,
                    severity=Severity.LOW,
                    title="EC2 EBS Optimization Not Enabled",
                    description=f"Instance '{iid}' does not use EBS-optimized I/O.",
                    remediation_template=f'aws ec2 modify-instance-attribute --instance-id {iid} --ebs-optimized',
                ))
        return findings
