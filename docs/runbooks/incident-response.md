# Incident Response Runbook

## 🚨 Emergency Response

### Immediate Actions (First 5 minutes)

1. **Acknowledge the Alert**
   - Respond to the alert in your monitoring system
   - Join the incident response channel: `#incident-response`
   - Set your status to "responding to incident"

2. **Initial Assessment**
   - Check service status: `make status`
   - Review recent deployments or changes
   - Identify affected services and users

3. **Communication**
   - Post in `#incident-response` with initial findings
   - If customer-facing, update status page
   - Escalate to manager if severity is critical

### Incident Severity Levels

| Severity | Description | Examples | Response Time |
|----------|-------------|----------|---------------|
| **P1 - Critical** | Complete service outage | API down, data loss | 5 minutes |
| **P2 - High** | Significant degradation | High error rates, slow response | 15 minutes |
| **P3 - Medium** | Partial functionality impact | Single feature broken | 1 hour |
| **P4 - Low** | Minor issues | Cosmetic issues, warnings | Next business day |

## 🔧 Common Incident Scenarios

### 1. Lambda Function Failures

**Symptoms:**
- High error rate in CloudWatch metrics
- Failed Lambda invocations
- Timeout errors

**Investigation Steps:**
```bash
# Check Lambda function logs
aws logs tail /aws/lambda/cloud-remediator-prowler-ingest --since 1h

# Check function configuration
aws lambda get-function --function-name cloud-remediator-prowler-ingest

# Check concurrent executions
aws lambda get-account-settings
```

**Common Causes & Solutions:**
- **Memory Issues**: Increase memory allocation in serverless.yml
- **Timeout**: Increase timeout duration
- **Permission Errors**: Check IAM roles and policies
- **Code Errors**: Review recent deployments, consider rollback

### 2. Neptune Database Issues

**Symptoms:**
- Connection timeouts
- Query performance degradation
- Database unavailability

**Investigation Steps:**
```bash
# Check Neptune cluster status
aws neptune describe-db-clusters --db-cluster-identifier cloud-remediator-neptune-prod

# Check performance metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Neptune \
  --metric-name CPUUtilization \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

**Common Solutions:**
- **High CPU**: Scale up instance size or optimize queries
- **Connection Issues**: Check security groups and VPC configuration
- **Storage Issues**: Monitor storage usage and add capacity
- **Performance**: Analyze slow queries and add indexes

### 3. High Error Rates

**Investigation Commands:**
```bash
# Check application logs
docker-compose logs -f cloud-remediator-sage

# Check metrics
curl http://localhost:9090/api/v1/query?query=rate(errors_total[5m])

# Check health endpoint
curl http://localhost:3000/health
```

**Resolution Steps:**
1. Identify error patterns in logs
2. Check external service dependencies
3. Review recent code changes
4. Consider rolling back if due to deployment

### 4. Performance Degradation

**Monitoring Commands:**
```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/health

# Check resource usage
docker stats cloud-remediator-sage

# Check Neptune query performance
aws neptune describe-db-cluster-parameter-groups
```

**Optimization Actions:**
1. Identify slow queries or operations
2. Check for resource bottlenecks
3. Review caching effectiveness
4. Consider scaling resources

## 📊 Debugging Tools & Commands

### Application Debugging

```bash
# View real-time logs
make logs

# Check container resource usage
docker stats

# Inspect configuration
docker inspect cloud-remediator-sage

# Check network connectivity
docker exec cloud-remediator-sage ping neptune-endpoint
```

### AWS Service Debugging

```bash
# Lambda function inspection
aws lambda list-functions
aws lambda get-function --function-name FUNCTION_NAME

# S3 bucket access
aws s3 ls s3://cloud-remediator-findings/
aws s3api head-bucket --bucket cloud-remediator-findings

# IAM role verification
aws iam get-role --role-name cloud-remediator-lambda-role
aws iam simulate-principal-policy --policy-source-arn ROLE_ARN --action-names s3:GetObject
```

### Database Debugging

```bash
# Neptune cluster information
aws neptune describe-db-clusters
aws neptune describe-db-instances

# Check Neptune endpoints
aws neptune describe-db-cluster-endpoints --db-cluster-identifier CLUSTER_ID

# Monitor slow queries (if logging enabled)
aws logs filter-log-events --log-group-name /aws/neptune/audit
```

## 🔄 Recovery Procedures

### Rollback Procedures

**Serverless Application Rollback:**
```bash
# List recent deployments
serverless deploy list --stage prod

# Rollback to previous version
serverless rollback --timestamp TIMESTAMP --stage prod

# Verify rollback
curl https://api.example.com/health
```

**Database Recovery:**
```bash
# Create point-in-time recovery
aws neptune restore-db-cluster-to-point-in-time \
  --db-cluster-identifier cloud-remediator-neptune-recovery \
  --source-db-cluster-identifier cloud-remediator-neptune-prod \
  --restore-to-time 2025-08-02T12:00:00.000Z

# Switch application to recovery cluster
# Update serverless.yml with new endpoint
```

**Infrastructure Recovery:**
```bash
# Terraform state recovery
terraform import aws_neptune_cluster.main CLUSTER_ID

# Re-apply infrastructure
terraform plan
terraform apply
```

### Data Recovery

**S3 Bucket Recovery:**
```bash
# List deleted objects (if versioning enabled)
aws s3api list-object-versions --bucket cloud-remediator-findings

# Restore deleted object
aws s3api restore-object --bucket BUCKET --key KEY --version-id VERSION_ID
```

**Neptune Data Recovery:**
```bash
# Export data before making changes
# (Neptune doesn't support direct data export, use application-level backup)

# Restore from backup
# Use application-specific restore procedures
```

## 📞 Escalation Procedures

### On-Call Escalation

**Level 1: On-Call Engineer (0-15 minutes)**
- Initial response and triage
- Basic troubleshooting
- Service restoration attempts

**Level 2: Team Lead (15-30 minutes)**
- Complex technical issues
- Architecture decisions
- Coordination with other teams

**Level 3: Manager + Senior Engineer (30+ minutes)**
- Major architectural changes
- Customer communication
- Post-incident analysis

### Contact Information

**Emergency Contacts:**
- On-Call Engineer: +1-XXX-XXX-XXXX
- Team Lead: +1-XXX-XXX-XXXX
- Manager: +1-XXX-XXX-XXXX

**Communication Channels:**
- Slack: `#incident-response`
- Email: `incident-response@terragon.ai`
- Status Page: `https://status.terragon.ai`

### External Vendor Escalation

**AWS Support:**
- Business Support: Create case in AWS Console
- Enterprise Support: Call support hotline
- TAM (Technical Account Manager): Direct contact

**Third-Party Services:**
- GitHub: Check status.github.com
- Docker Hub: Check status.docker.com
- NPM Registry: Check status.npmjs.org

## 📋 Post-Incident Procedures

### Immediate Post-Incident (Within 24 hours)

1. **Service Verification**
   - Confirm all services are operational
   - Validate metrics have returned to normal
   - Check for any residual issues

2. **Timeline Documentation**
   - Document incident timeline
   - Record actions taken
   - Note resolution steps

3. **Stakeholder Communication**
   - Update status page
   - Notify affected customers
   - Internal team notification

### Post-Incident Review (Within 1 week)

**Review Meeting Agenda:**
1. Incident timeline review
2. Root cause analysis
3. Response effectiveness
4. Action items identification
5. Process improvements

**Deliverables:**
- Post-incident report
- Action items with owners
- Process updates
- Tool/monitoring improvements

### Root Cause Analysis Template

```markdown
# Post-Incident Report: [Incident Title]

## Summary
- **Incident Date**: YYYY-MM-DD
- **Duration**: X hours Y minutes
- **Severity**: PX
- **Services Affected**: List of services
- **Customer Impact**: Description

## Timeline
- **HH:MM** - Event description
- **HH:MM** - Action taken
- **HH:MM** - Resolution

## Root Cause
Detailed analysis of what caused the incident

## Impact Assessment
- Customer impact
- Revenue impact
- Reputation impact
- Internal team impact

## Response Analysis
What went well and what could be improved

## Action Items
1. [Action] - [Owner] - [Due Date]
2. [Action] - [Owner] - [Due Date]

## Lessons Learned
Key takeaways for future incidents
```

## 🛠️ Preventive Measures

### Monitoring Improvements

**After Each Incident:**
- Review alerting effectiveness
- Add missing monitoring
- Adjust alert thresholds
- Update dashboards

**Regular Reviews:**
- Monthly monitoring review
- Quarterly runbook updates
- Annual process assessment

### Process Improvements

**Documentation:**
- Update runbooks based on incidents
- Improve troubleshooting guides
- Enhance monitoring documentation

**Training:**
- Incident response training
- New team member onboarding
- Regular drill exercises

**Automation:**
- Automate common fixes
- Improve deployment processes
- Enhance monitoring automation

### Infrastructure Hardening

**Reliability:**
- Implement circuit breakers
- Add redundancy
- Improve error handling

**Monitoring:**
- Add health checks
- Implement distributed tracing
- Enhance logging

**Security:**
- Regular security reviews
- Vulnerability assessments
- Access control audits

---

**Document Version**: 1.0  
**Last Updated**: 2025-08-02  
**Next Review**: 2025-11-02  
**Owner**: Cloud Remediator Sage Operations Team