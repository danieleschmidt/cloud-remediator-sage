"""Tests for cloud-remediator-sage."""
import sys
sys.path.insert(0, '/home/dschmidt/repos/cloud-remediator-sage/src')
import pytest
from cloud_remediator import SecurityScanner, RemediationEngine, PriorityGraph, Severity, ResourceType

SCANNER = SecurityScanner()


def _config(**kwargs):
    return {
        "s3_buckets": [], "security_groups": [], "iam_users": [],
        "iam_roles": [], "rds_instances": [], "ebs_volumes": [],
        "cloudtrail": {}, "ec2_instances": [],
        **kwargs,
    }


class TestS3Rules:
    def test_public_bucket_critical(self):
        f = SCANNER.scan(_config(s3_buckets=[{"id": "open-bucket", "public": True}]))
        assert any(x.rule_id == "S3-001" and x.severity == Severity.CRITICAL for x in f)

    def test_unencrypted_bucket_high(self):
        f = SCANNER.scan(_config(s3_buckets=[{"id": "b", "encrypted": False}]))
        assert any(x.rule_id == "S3-002" and x.severity == Severity.HIGH for x in f)

    def test_no_versioning_medium(self):
        f = SCANNER.scan(_config(s3_buckets=[{"id": "b", "versioning_enabled": False}]))
        assert any(x.rule_id == "S3-003" and x.severity == Severity.MEDIUM for x in f)

    def test_no_logging_low(self):
        f = SCANNER.scan(_config(s3_buckets=[{"id": "b", "logging_enabled": False}]))
        assert any(x.rule_id == "S3-004" and x.severity == Severity.LOW for x in f)

    def test_compliant_bucket_no_findings(self):
        f = SCANNER.scan(_config(s3_buckets=[{
            "id": "secure", "public": False, "encrypted": True,
            "versioning_enabled": True, "logging_enabled": True
        }]))
        assert not any(x.resource_id == "secure" for x in f)


class TestSecurityGroupRules:
    def test_ssh_open_to_internet(self):
        sg = {"id": "sg-1", "rules": [{"cidr": "0.0.0.0/0", "port": 22}]}
        f = SCANNER.scan(_config(security_groups=[sg]))
        assert any(x.rule_id == "SG-001" and x.severity == Severity.CRITICAL for x in f)

    def test_rdp_open_to_internet(self):
        sg = {"id": "sg-2", "rules": [{"cidr": "0.0.0.0/0", "port": 3389}]}
        f = SCANNER.scan(_config(security_groups=[sg]))
        assert any(x.rule_id == "SG-001" for x in f)

    def test_all_traffic_open(self):
        sg = {"id": "sg-3", "rules": [{"cidr": "0.0.0.0/0", "all_traffic": True}]}
        f = SCANNER.scan(_config(security_groups=[sg]))
        assert any(x.rule_id == "SG-002" and x.severity == Severity.HIGH for x in f)

    def test_restricted_sg_no_findings(self):
        sg = {"id": "sg-ok", "rules": [{"cidr": "10.0.0.0/8", "port": 22}]}
        f = SCANNER.scan(_config(security_groups=[sg]))
        assert not any(x.resource_id == "sg-ok" for x in f)


class TestIAMRules:
    def test_user_without_mfa(self):
        f = SCANNER.scan(_config(iam_users=[{"id": "alice", "mfa_enabled": False}]))
        assert any(x.rule_id == "IAM-001" and x.severity == Severity.HIGH for x in f)

    def test_old_access_key(self):
        f = SCANNER.scan(_config(iam_users=[{"id": "bob", "access_keys": [{"age_days": 120, "id": "AKIA..."}]}]))
        assert any(x.rule_id == "IAM-002" and x.severity == Severity.MEDIUM for x in f)

    def test_wildcard_role(self):
        role = {"id": "admin-role", "policy": {"effect": "Allow", "action": "*", "resource": "*"}}
        f = SCANNER.scan(_config(iam_roles=[role]))
        assert any(x.rule_id == "IAM-003" and x.severity == Severity.CRITICAL for x in f)


class TestRDSRules:
    def test_public_rds(self):
        f = SCANNER.scan(_config(rds_instances=[{"id": "prod-db", "publicly_accessible": True}]))
        assert any(x.rule_id == "RDS-001" and x.severity == Severity.CRITICAL for x in f)

    def test_unencrypted_rds(self):
        f = SCANNER.scan(_config(rds_instances=[{"id": "db", "encrypted": False}]))
        assert any(x.rule_id == "RDS-002" and x.severity == Severity.HIGH for x in f)


class TestCloudTrail:
    def test_no_cloudtrail(self):
        f = SCANNER.scan(_config(cloudtrail={"enabled": False}))
        assert any(x.rule_id == "CT-001" and x.severity == Severity.CRITICAL for x in f)

    def test_single_region_cloudtrail(self):
        f = SCANNER.scan(_config(cloudtrail={"enabled": True, "multi_region": False}))
        assert any(x.rule_id == "CT-002" for x in f)


class TestEBS:
    def test_unencrypted_volume(self):
        f = SCANNER.scan(_config(ebs_volumes=[{"id": "vol-123", "encrypted": False}]))
        assert any(x.rule_id == "EBS-001" and x.severity == Severity.HIGH for x in f)


class TestSortingAndOutput:
    def test_findings_sorted_by_severity(self):
        config = _config(
            s3_buckets=[{"id": "b", "public": True, "logging_enabled": False}],
        )
        f = SCANNER.scan(config)
        for i in range(len(f) - 1):
            assert f[i].severity.value >= f[i+1].severity.value

    def test_remediation_template_nonempty(self):
        f = SCANNER.scan(_config(s3_buckets=[{"id": "b", "public": True}]))
        for finding in f:
            assert finding.remediation_template.strip()

    def test_resource_type_set(self):
        f = SCANNER.scan(_config(s3_buckets=[{"id": "b", "public": True}]))
        assert all(isinstance(x.resource_type, ResourceType) for x in f)


class TestRemediationEngine:
    def test_generate_report_string(self):
        f = SCANNER.scan(_config(s3_buckets=[{"id": "b", "public": True}]))
        report = RemediationEngine().generate_report(f)
        assert isinstance(report, str) and "S3-001" in report

    def test_generate_json_list(self):
        f = SCANNER.scan(_config(s3_buckets=[{"id": "b", "public": True}]))
        j = RemediationEngine().generate_json(f)
        assert isinstance(j, list) and j[0]["rule_id"] == "S3-001"


class TestPriorityGraph:
    def test_ordered_plan_returns_all(self):
        f = SCANNER.scan(_config(
            s3_buckets=[{"id": "b", "public": True}],
            iam_roles=[{"id": "r", "policy": {"effect": "Allow", "action": "*", "resource": "*"}}],
        ))
        g = PriorityGraph(f)
        plan = g.ordered_plan()
        assert len(plan) == len(f)

    def test_summary_counts(self):
        f = SCANNER.scan(_config(
            s3_buckets=[{"id": "b", "public": True, "encrypted": False}],
        ))
        g = PriorityGraph(f)
        s = g.summary()
        assert s.get("CRITICAL", 0) >= 1
        assert s.get("HIGH", 0) >= 1
