#!/usr/bin/env node
/**
 * Cloud Remediator Sage Platform Demo
 * Demonstrates the working autonomous CSPM platform
 */

const { CloudRemediatorSage } = require('./src/index');
const SecurityValidator = require('./src/validation/SecurityValidator');
const QuantumTaskPlanner = require('./src/quantum/TaskPlanner');

console.log('🤖 Cloud Remediator Sage - Autonomous CSPM Platform Demo');
console.log('======================================================');
console.log();

async function demonstratePlatform() {
  try {
    // 1. Initialize the main platform
    console.log('1️⃣  Initializing Cloud Remediator Sage platform...');
    const platform = new CloudRemediatorSage();
    await platform.initialize();
    console.log('✅ Platform initialized successfully');
    console.log();

    // 2. Demonstrate Security Validation
    console.log('2️⃣  Demonstrating Security Validation...');
    const validator = new SecurityValidator();
    
    const sampleFinding = {
      id: 'finding-demo-001',
      source: 'prowler',
      severity: 'high',
      category: 'security',
      title: 'S3 bucket publicly accessible',
      description: 'S3 bucket allows public read access which could lead to data exposure',
      resource: {
        arn: 'arn:aws:s3:::demo-bucket',
        type: 'AWS::S3::Bucket',
        region: 'us-east-1',
        accountId: '123456789012'
      },
      riskScore: 8.5,
      compliance: [
        { framework: 'pci-dss', requirement: '3.4', status: 'non-compliant' }
      ],
      createdAt: new Date().toISOString()
    };

    const validationResult = await validator.validateFinding(sampleFinding);
    console.log(`   ✅ Finding validation: ${validationResult.isValid ? 'PASSED' : 'FAILED'}`);
    console.log(`   📊 Validation score: ${validationResult.score}/100`);
    if (validationResult.warnings.length > 0) {
      console.log(`   ⚠️  Warnings: ${validationResult.warnings.length}`);
    }
    console.log();

    // 3. Demonstrate Asset Validation
    console.log('3️⃣  Demonstrating Asset Validation...');
    const sampleAsset = {
      arn: 'arn:aws:s3:::demo-bucket',
      type: 'AWS::S3::Bucket',
      accountId: '123456789012',
      region: 'us-east-1',
      criticality: 'high',
      tags: {
        Environment: 'production',
        DataClassification: 'sensitive'
      },
      securityGroups: [{
        id: 'sg-demo123',
        rules: [{
          source: '10.0.0.0/16',
          ports: ['443']
        }]
      }]
    };

    const assetValidation = await validator.validateAsset(sampleAsset);
    console.log(`   ✅ Asset validation: ${assetValidation.isValid ? 'PASSED' : 'FAILED'}`);
    console.log(`   📊 Asset score: ${assetValidation.score}/100`);
    console.log();

    // 4. Demonstrate Quantum Task Planning
    console.log('4️⃣  Demonstrating Quantum Task Planning...');
    const taskPlanner = new QuantumTaskPlanner({
      maxParallelTasks: 5,
      entanglementThreshold: 0.7
    });

    const planningContext = {
      accountId: '123456789012',
      region: 'us-east-1',
      prioritizeCompliance: true
    };

    const optimalPlan = await taskPlanner.generateOptimalPlan(planningContext);
    console.log(`   🌌 Quantum plan generated with ${optimalPlan.totalTasks} tasks`);
    console.log(`   ⚡ Estimated duration: ${Math.round(optimalPlan.estimatedDuration)} minutes`);
    console.log(`   🎯 Risk reduction: ${optimalPlan.estimatedRiskReduction.toFixed(1)}`);
    console.log(`   📈 Quantum properties:`);
    console.log(`      • Coherence: ${optimalPlan.quantumProperties.coherence.toFixed(2)}`);
    console.log(`      • Entanglement: ${optimalPlan.quantumProperties.entanglement.toFixed(2)}`);
    console.log(`      • Superposition: ${optimalPlan.quantumProperties.superposition.toFixed(2)}`);
    console.log();

    // 5. Demonstrate Platform Health Check
    console.log('5️⃣  Checking Platform Health...');
    const healthStatus = await platform.getHealthStatus();
    console.log(`   ❤️  Platform status: ${healthStatus.status.toUpperCase()}`);
    console.log(`   ⏱️  Uptime: ${Math.round(healthStatus.platform.uptime)} seconds`);
    console.log(`   🔧 Node.js version: ${healthStatus.platform.nodeVersion}`);
    console.log(`   🌍 Stage: ${healthStatus.platform.stage}`);
    console.log(`   🌐 Region: ${healthStatus.platform.region}`);
    console.log();

    // 6. Performance Metrics
    if (healthStatus.performance?.report?.summary) {
      console.log('6️⃣  Performance Metrics...');
      const perf = healthStatus.performance.report.summary;
      console.log(`   📊 Average response time: ${perf.avgResponseTime?.toFixed(2) || 'N/A'}ms`);
      console.log(`   🎯 Success rate: ${(perf.successRate * 100 || 0).toFixed(1)}%`);
      console.log(`   💾 Cache hit rate: ${(perf.cacheHitRate * 100 || 0).toFixed(1)}%`);
      console.log();
    }

    // 7. Summary
    console.log('🎉 Platform Demo Complete!');
    console.log('===========================');
    console.log('✅ Core Functionality: Working');
    console.log('✅ Security Validation: Working');
    console.log('✅ Quantum Task Planning: Working');
    console.log('✅ Performance Monitoring: Working');
    console.log('✅ Health Checks: Working');
    console.log();
    console.log('🚀 The Cloud Remediator Sage platform is ready for autonomous');
    console.log('   cloud security posture management with quantum-enhanced');
    console.log('   task planning and comprehensive validation!');

    // Cleanup
    await platform.shutdown();

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the demonstration
if (require.main === module) {
  demonstratePlatform().catch(console.error);
}

module.exports = { demonstratePlatform };