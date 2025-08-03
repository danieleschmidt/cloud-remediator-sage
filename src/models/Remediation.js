/**
 * Remediation Model
 * Represents an automated fix for a security finding
 */

class Remediation {
  constructor(data) {
    this.id = data.id || this.generateId(data);
    this.findingId = data.findingId;
    this.assetArn = data.assetArn;
    this.type = data.type; // terraform, cloudformation, boto3, cli, manual
    this.category = data.category; // configuration, iam, network, encryption
    this.title = data.title;
    this.description = data.description;
    this.riskLevel = data.riskLevel || 'low';
    this.automationLevel = data.automationLevel || 'manual';
    this.template = data.template;
    this.templateType = data.templateType;
    this.parameters = data.parameters || {};
    this.validationSteps = data.validationSteps || [];
    this.rollbackSteps = data.rollbackSteps || [];
    this.approvalRequired = data.approvalRequired !== false;
    this.estimatedDuration = data.estimatedDuration; // in minutes
    this.estimatedCost = data.estimatedCost; // in USD
    this.prerequisites = data.prerequisites || [];
    this.impacts = data.impacts || [];
    this.compliance = data.compliance || [];
    this.tags = data.tags || {};
    this.metadata = data.metadata || {};
    this.status = data.status || 'pending';
    this.executionHistory = data.executionHistory || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.approvedAt = data.approvedAt;
    this.approvedBy = data.approvedBy;
    this.executedAt = data.executedAt;
    this.executedBy = data.executedBy;
  }

  generateId(data) {
    const findingId = data.findingId || 'unknown';
    const type = data.type || 'unknown';
    const hash = require('crypto')
      .createHash('sha256')
      .update(`${findingId}:${type}:${Date.now()}`)
      .digest('hex')
      .substring(0, 16);
    return `remediation-${hash}`;
  }

  getRiskScore() {
    const riskScores = {
      critical: 10,
      high: 8,
      medium: 5,
      low: 2,
      minimal: 1
    };
    return riskScores[this.riskLevel] || 2;
  }

  getAutomationScore() {
    const automationScores = {
      full: 10,
      partial: 7,
      assisted: 5,
      manual: 1
    };
    return automationScores[this.automationLevel] || 1;
  }

  canAutoExecute() {
    return this.automationLevel === 'full' && 
           this.riskLevel !== 'critical' && 
           !this.approvalRequired;
  }

  requiresApproval() {
    return this.approvalRequired || 
           this.riskLevel === 'critical' || 
           this.riskLevel === 'high';
  }

  calculateWSJFScore(urgency, effort) {
    // WSJF = (Business Value + Time Criticality + Risk Reduction) / Job Size
    const businessValue = this.getBusinessValue();
    const timeCriticality = this.getTimeCriticality();
    const riskReduction = this.getRiskScore();
    const jobSize = effort || this.estimatedDuration || 60;
    
    return (businessValue + timeCriticality + riskReduction) / (jobSize / 60);
  }

  getBusinessValue() {
    // Calculate business value based on compliance and impact
    let value = 5; // base value
    
    // Add value for compliance frameworks
    value += this.compliance.length * 2;
    
    // Add value for security improvements
    if (this.category === 'iam') value += 3;
    if (this.category === 'encryption') value += 2;
    if (this.category === 'network') value += 2;
    
    return Math.min(value, 10);
  }

  getTimeCriticality() {
    // Calculate urgency based on finding severity and asset criticality
    let criticality = 5; // base criticality
    
    if (this.riskLevel === 'critical') criticality = 10;
    else if (this.riskLevel === 'high') criticality = 8;
    else if (this.riskLevel === 'medium') criticality = 5;
    else if (this.riskLevel === 'low') criticality = 3;
    
    return criticality;
  }

  addExecutionRecord(record) {
    this.executionHistory.push({
      timestamp: new Date(),
      status: record.status,
      executor: record.executor,
      duration: record.duration,
      result: record.result,
      error: record.error,
      metadata: record.metadata || {}
    });
    this.updatedAt = new Date();
  }

  generateTerraformTemplate() {
    if (this.templateType !== 'terraform') return null;
    
    const template = {
      terraform: {
        required_version: ">= 0.14"
      },
      provider: {
        aws: {
          region: this.parameters.region || "us-east-1"
        }
      },
      resource: this.template.resources || {},
      data: this.template.data || {},
      output: this.template.outputs || {}
    };
    
    return JSON.stringify(template, null, 2);
  }

  generateCloudFormationTemplate() {
    if (this.templateType !== 'cloudformation') return null;
    
    const template = {
      AWSTemplateFormatVersion: "2010-09-09",
      Description: this.description,
      Parameters: this.template.parameters || {},
      Resources: this.template.resources || {},
      Outputs: this.template.outputs || {}
    };
    
    return JSON.stringify(template, null, 2);
  }

  generateBoto3Script() {
    if (this.templateType !== 'boto3') return null;
    
    const script = `#!/usr/bin/env python3
"""
Automated remediation script for: ${this.title}
Generated by Cloud Remediator Sage
"""

import boto3
import json
from botocore.exceptions import ClientError

def main():
    """Execute remediation steps"""
    try:
        ${this.template.script || '# Remediation logic here'}
        print("Remediation completed successfully")
        return True
    except ClientError as e:
        print(f"AWS API Error: {e}")
        return False
    except Exception as e:
        print(f"Remediation failed: {e}")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
`;
    
    return script;
  }

  toNeptuneVertex() {
    return {
      label: 'Remediation',
      properties: {
        id: this.id,
        findingId: this.findingId,
        assetArn: this.assetArn,
        type: this.type,
        category: this.category,
        title: this.title,
        riskLevel: this.riskLevel,
        automationLevel: this.automationLevel,
        status: this.status,
        approvalRequired: this.approvalRequired,
        estimatedDuration: this.estimatedDuration,
        estimatedCost: this.estimatedCost,
        canAutoExecute: this.canAutoExecute(),
        createdAt: this.createdAt.toISOString(),
        updatedAt: this.updatedAt.toISOString()
      }
    };
  }

  validate() {
    const errors = [];
    
    if (!this.findingId) errors.push('findingId is required');
    if (!this.type) errors.push('type is required');
    if (!this.title) errors.push('title is required');
    if (!['terraform', 'cloudformation', 'boto3', 'cli', 'manual'].includes(this.type)) {
      errors.push('invalid remediation type');
    }
    if (!['critical', 'high', 'medium', 'low', 'minimal'].includes(this.riskLevel)) {
      errors.push('invalid risk level');
    }
    if (!['full', 'partial', 'assisted', 'manual'].includes(this.automationLevel)) {
      errors.push('invalid automation level');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static createFromTemplate(findingId, templateName, templateData) {
    const templates = RemediationTemplates.getTemplate(templateName);
    if (!templates) {
      throw new Error(`Template ${templateName} not found`);
    }
    
    return new Remediation({
      findingId,
      ...templates,
      parameters: { ...templates.parameters, ...templateData.parameters }
    });
  }
}

class RemediationTemplates {
  static getTemplate(name) {
    const templates = {
      's3-public-read-block': {
        type: 'terraform',
        templateType: 'terraform',
        category: 'configuration',
        title: 'Block S3 Bucket Public Read Access',
        description: 'Blocks public read access to S3 bucket',
        riskLevel: 'medium',
        automationLevel: 'full',
        approvalRequired: false,
        template: {
          resources: {
            s3_bucket_public_access_block: {
              aws_s3_bucket_public_access_block: {
                "${var.bucket_name}": {
                  bucket: "${var.bucket_name}",
                  block_public_acls: true,
                  block_public_policy: true,
                  ignore_public_acls: true,
                  restrict_public_buckets: true
                }
              }
            }
          },
          parameters: {
            bucket_name: {
              type: "string",
              description: "S3 bucket name to secure"
            }
          }
        },
        estimatedDuration: 5,
        estimatedCost: 0
      },
      
      'security-group-restrict-ssh': {
        type: 'terraform',
        templateType: 'terraform',
        category: 'network',
        title: 'Restrict SSH Access in Security Group',
        description: 'Removes 0.0.0.0/0 SSH access from security group',
        riskLevel: 'high',
        automationLevel: 'full',
        approvalRequired: true,
        template: {
          resources: {
            security_group_rule_removal: {
              aws_security_group_rule: {
                ssh_removal: {
                  type: "ingress",
                  from_port: 22,
                  to_port: 22,
                  protocol: "tcp",
                  cidr_blocks: ["${var.allowed_cidr}"],
                  security_group_id: "${var.security_group_id}"
                }
              }
            }
          }
        },
        estimatedDuration: 10,
        estimatedCost: 0
      }
    };
    
    return templates[name];
  }
  
  static getAllTemplates() {
    return Object.keys(this.getTemplate(''));
  }
}

module.exports = { Remediation, RemediationTemplates };