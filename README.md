# cloud-remediator-sage

[![Build Status](https://img.shields.io/github/actions/workflow/status/danieleschmidt/cloud-remediator-sage/ci.yml?branch=main)](https://github.com/danieleschmidt/cloud-remediator-sage/actions)
[![Coverage Status](https://img.shields.io/coveralls/github/danieleschmidt/cloud-remediator-sage)](https://coveralls.io/github/danieleschmidt/cloud-remediator-sage)
[![License](https://img.shields.io/github/license/danieleschmidt/cloud-remediator-sage)](LICENSE)
[![Version](https://img.shields.io/badge/version-v0.1.0-blue)](https://semver.org)

A serverless framework to automate cloud security posture management (CSPM). It ingests security findings from scanners, prioritizes risks using a graph database, and auto-generates Infrastructure-as-Code (IaC) for remediation.

## ✨ Key Features

*   **Multi-Cloud/SaaS Coverage**: Ingests findings from:
    *   **Prowler**: AWS, Azure, GCP, Kubernetes, Microsoft 365
    *   **CloudSploit**: OCI
    *   **Steampipe**: Microsoft 365
*   **Risk Graph Triage**: Utilizes Amazon Neptune to deduplicate findings and score risks.
*   **Automated Fix Generation**: Employs Jinja templates to create ready-to-use Terraform or Boto3 remediation scripts.
*   **Safe Mode**: Requires manual approval for remediation actions in production environments.
*   **🤖 Autonomous Backlog Management**: WSJF-prioritized autonomous execution with TDD and security integration. [Learn more](AUTONOMOUS_BACKLOG.md)

## 🛠️ Technical Details

### Risk Scoring Formula

`RiskScore = (CVSS_Weight * Asset_Exposure_Score) + Blast_Radius_Impact`

### Permissions for Amazon Neptune

Autonomous agents must use IAM database authentication with Gremlin. Ensure the execution role has a policy allowing `neptune-db:connect` via SigV4. See the [AWS documentation on connecting to Neptune with Gremlin and SigV4](https://docs.aws.amazon.com/neptune/latest/userguide/iam-auth-connecting-gremlin-console.html) for a detailed guide.

## ⚡ Quick Start

1.  Clone the repository and `cd` into the directory.
2.  Configure `serverless.yml` with your AWS credentials and Neptune endpoint.
3.  Deploy the framework: `serverless deploy`.

## 📈 Roadmap

*   **v0.1.0**: Integration with Prowler; initial Terraform templates for AWS.
*   **v0.2.0**: Connectors for CloudSploit and Steampipe; Azure/GCP remediation packs.
*   **v0.3.0**: Enhanced risk triage logic.

## 🤝 Contributing

We welcome contributions! Please see our organization-wide `CONTRIBUTING.md` for guidelines and our `CODE_OF_CONDUCT.md`. A `CHANGELOG.md` is maintained for version history.

## 📝 Licenses & Attribution

This project is licensed under the Apache-2.0 License. It uses downstream dependencies with their own licenses. Copies can be found in the `LICENSES/` directory.
*   **Prowler**: Apache-2.0 License
*   **CloudSploit (by Aqua)**: GNU General Public License v3.0

## 📚 References

*   **Prowler**: [Prowler Official Site](https://prowler.com/)
*   **Steampipe M365 Compliance Mod**: [Steampipe Hub](https://hub.steampipe.io/mods/turbot/microsoft365_compliance)
