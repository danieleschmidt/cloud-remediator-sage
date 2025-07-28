#!/usr/bin/env node

/**
 * Software Bill of Materials (SBOM) Generator
 * Generates CycloneDX format SBOM for Cloud Remediator Sage
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class SBOMGenerator {
    constructor() {
        this.packageJson = this.loadPackageJson();
        this.sbom = {
            bomFormat: 'CycloneDX',
            specVersion: '1.4',
            serialNumber: `urn:uuid:${this.generateUUID()}`,
            version: 1,
            metadata: this.generateMetadata(),
            components: []
        };
    }

    loadPackageJson() {
        const packagePath = path.join(process.cwd(), 'package.json');
        if (!fs.existsSync(packagePath)) {
            throw new Error('package.json not found');
        }
        return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    generateMetadata() {
        return {
            timestamp: new Date().toISOString(),
            tools: [
                {
                    vendor: 'Terragon Labs',
                    name: 'SBOM Generator',
                    version: '1.0.0'
                }
            ],
            component: {
                type: 'application',
                'bom-ref': `${this.packageJson.name}@${this.packageJson.version}`,
                name: this.packageJson.name,
                version: this.packageJson.version,
                description: this.packageJson.description,
                licenses: [
                    {
                        license: {
                            name: this.packageJson.license || 'Unknown'
                        }
                    }
                ],
                purl: `pkg:npm/${this.packageJson.name}@${this.packageJson.version}`,
                externalReferences: this.generateExternalReferences()
            }
        };
    }

    generateExternalReferences() {
        const refs = [];
        
        if (this.packageJson.repository) {
            refs.push({
                type: 'vcs',
                url: this.packageJson.repository.url || this.packageJson.repository
            });
        }
        
        if (this.packageJson.homepage) {
            refs.push({
                type: 'website',
                url: this.packageJson.homepage
            });
        }
        
        if (this.packageJson.bugs) {
            refs.push({
                type: 'issue-tracker',
                url: this.packageJson.bugs.url || this.packageJson.bugs
            });
        }
        
        return refs;
    }

    async generateComponents() {
        console.log('Generating component list...');
        
        // Get production dependencies
        await this.addDependencies('dependencies', 'required');
        
        // Get development dependencies
        await this.addDependencies('devDependencies', 'optional');
        
        // Add runtime dependencies (AWS services, etc.)
        this.addRuntimeDependencies();
        
        console.log(`Found ${this.sbom.components.length} components`);
    }

    async addDependencies(dependencyType, scope) {
        const deps = this.packageJson[dependencyType] || {};
        
        for (const [name, version] of Object.entries(deps)) {
            const component = await this.createComponentFromPackage(name, version, scope);
            if (component) {
                this.sbom.components.push(component);
            }
        }
    }

    async createComponentFromPackage(name, versionSpec, scope) {
        try {
            // Get installed version from package-lock.json or node_modules
            const installedVersion = this.getInstalledVersion(name);
            
            const component = {
                type: 'library',
                'bom-ref': `${name}@${installedVersion}`,
                name: name,
                version: installedVersion,
                scope: scope,
                purl: `pkg:npm/${name}@${installedVersion}`,
                licenses: await this.getLicenseInfo(name),
                hashes: await this.getPackageHashes(name, installedVersion),
                externalReferences: [
                    {
                        type: 'distribution',
                        url: `https://registry.npmjs.org/${name}/-/${name}-${installedVersion}.tgz`
                    }
                ]
            };
            
            // Add vulnerability information if available
            const vulnerabilities = await this.getVulnerabilities(name, installedVersion);
            if (vulnerabilities.length > 0) {
                component.vulnerabilities = vulnerabilities;
            }
            
            return component;
        } catch (error) {
            console.warn(`Warning: Could not process package ${name}: ${error.message}`);
            return null;
        }
    }

    getInstalledVersion(packageName) {
        try {
            // Try to get version from package-lock.json first
            const packageLockPath = path.join(process.cwd(), 'package-lock.json');
            if (fs.existsSync(packageLockPath)) {
                const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
                if (packageLock.packages && packageLock.packages[`node_modules/${packageName}`]) {
                    return packageLock.packages[`node_modules/${packageName}`].version;
                }
            }
            
            // Fallback to node_modules package.json
            const packagePath = path.join(process.cwd(), 'node_modules', packageName, 'package.json');
            if (fs.existsSync(packagePath)) {
                const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
                return pkg.version;
            }
            
            // Last resort: use npm list
            const npmList = execSync(`npm list ${packageName} --depth=0 --json`, { encoding: 'utf8' });
            const listData = JSON.parse(npmList);
            if (listData.dependencies && listData.dependencies[packageName]) {
                return listData.dependencies[packageName].version;
            }
        } catch (error) {
            console.warn(`Could not determine version for ${packageName}`);
        }
        
        return 'unknown';
    }

    async getLicenseInfo(packageName) {
        try {
            const packagePath = path.join(process.cwd(), 'node_modules', packageName, 'package.json');
            if (fs.existsSync(packagePath)) {
                const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
                if (pkg.license) {
                    return [{ license: { name: pkg.license } }];
                }
                if (pkg.licenses && Array.isArray(pkg.licenses)) {
                    return pkg.licenses.map(license => ({
                        license: { name: license.type || license }
                    }));
                }
            }
        } catch (error) {
            console.warn(`Could not determine license for ${packageName}`);
        }
        
        return [{ license: { name: 'Unknown' } }];
    }

    async getPackageHashes(packageName, version) {
        try {
            const tarballPath = path.join(process.cwd(), 'node_modules', packageName, 'package.json');
            if (fs.existsSync(tarballPath)) {
                const content = fs.readFileSync(tarballPath);
                const sha256 = crypto.createHash('sha256').update(content).digest('hex');
                const sha1 = crypto.createHash('sha1').update(content).digest('hex');
                
                return [
                    { alg: 'SHA-256', content: sha256 },
                    { alg: 'SHA-1', content: sha1 }
                ];
            }
        } catch (error) {
            console.warn(`Could not generate hashes for ${packageName}`);
        }
        
        return [];
    }

    async getVulnerabilities(packageName, version) {
        // This would integrate with vulnerability databases
        // For now, return empty array
        // In production, you might use npm audit or other tools
        return [];
    }

    addRuntimeDependencies() {
        // Add AWS services and other runtime dependencies
        const runtimeDeps = [
            {
                type: 'platform',
                'bom-ref': 'aws-lambda',
                name: 'AWS Lambda',
                version: 'latest',
                description: 'AWS Lambda serverless compute service',
                scope: 'required',
                externalReferences: [
                    {
                        type: 'documentation',
                        url: 'https://docs.aws.amazon.com/lambda/'
                    }
                ]
            },
            {
                type: 'platform',
                'bom-ref': 'aws-neptune',
                name: 'AWS Neptune',
                version: 'latest',
                description: 'AWS Neptune graph database service',
                scope: 'required',
                externalReferences: [
                    {
                        type: 'documentation',
                        url: 'https://docs.aws.amazon.com/neptune/'
                    }
                ]
            },
            {
                type: 'platform',
                'bom-ref': 'aws-s3',
                name: 'AWS S3',
                version: 'latest',
                description: 'AWS S3 object storage service',
                scope: 'required',
                externalReferences: [
                    {
                        type: 'documentation',
                        url: 'https://docs.aws.amazon.com/s3/'
                    }
                ]
            },
            {
                type: 'platform',
                'bom-ref': 'nodejs',
                name: 'Node.js',
                version: process.version,
                description: 'JavaScript runtime built on Chrome V8 JavaScript engine',
                scope: 'required',
                externalReferences: [
                    {
                        type: 'website',
                        url: 'https://nodejs.org/'
                    }
                ]
            }
        ];
        
        this.sbom.components.push(...runtimeDeps);
    }

    generateDependencyGraph() {
        // Generate dependency relationships
        const dependencies = [];
        
        for (const component of this.sbom.components) {
            if (component.scope === 'required' && component.type === 'library') {
                dependencies.push({
                    ref: this.sbom.metadata.component['bom-ref'],
                    dependsOn: [component['bom-ref']]
                });
            }
        }
        
        if (dependencies.length > 0) {
            this.sbom.dependencies = dependencies;
        }
    }

    addSecurityMetadata() {
        // Add security-related metadata
        this.sbom.metadata.properties = [
            {
                name: 'cdx:security:classification',
                value: 'confidential'
            },
            {
                name: 'cdx:security:environment',
                value: process.env.STAGE || 'development'
            },
            {
                name: 'cdx:compliance:framework',
                value: 'SOC2,ISO27001'
            },
            {
                name: 'cdx:build:timestamp',
                value: new Date().toISOString()
            },
            {
                name: 'cdx:build:version',
                value: process.env.BUILD_VERSION || 'local'
            }
        ];
    }

    generateSignature() {
        // In production, this would use proper digital signatures
        const content = JSON.stringify(this.sbom, null, 2);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        
        this.sbom.signature = {
            algorithm: 'SHA-256',
            value: hash,
            timestamp: new Date().toISOString()
        };
    }

    async generate() {
        console.log('Generating SBOM for Cloud Remediator Sage...');
        
        try {
            await this.generateComponents();
            this.generateDependencyGraph();
            this.addSecurityMetadata();
            this.generateSignature();
            
            return this.sbom;
        } catch (error) {
            console.error('Error generating SBOM:', error);
            throw error;
        }
    }

    async saveToFile(outputPath = './sbom.json') {
        const sbom = await this.generate();
        
        fs.writeFileSync(outputPath, JSON.stringify(sbom, null, 2));
        console.log(`SBOM generated successfully: ${outputPath}`);
        
        // Also generate SPDX format if requested
        if (process.env.GENERATE_SPDX === 'true') {
            const spdxPath = outputPath.replace('.json', '.spdx.json');
            const spdxSbom = this.convertToSPDX(sbom);
            fs.writeFileSync(spdxPath, JSON.stringify(spdxSbom, null, 2));
            console.log(`SPDX SBOM generated: ${spdxPath}`);
        }
    }

    convertToSPDX(cycloneDxSbom) {
        // Convert CycloneDX to SPDX format
        return {
            spdxVersion: 'SPDX-2.3',
            dataLicense: 'CC0-1.0',
            SPDXID: 'SPDXRef-DOCUMENT',
            name: cycloneDxSbom.metadata.component.name,
            documentNamespace: `https://terragonlabs.com/sbom/${cycloneDxSbom.serialNumber}`,
            creationInfo: {
                created: cycloneDxSbom.metadata.timestamp,
                creators: ['Tool: Cloud Remediator SBOM Generator']
            },
            packages: cycloneDxSbom.components.map((comp, index) => ({
                SPDXID: `SPDXRef-Package-${index}`,
                name: comp.name,
                versionInfo: comp.version,
                downloadLocation: comp.externalReferences?.[0]?.url || 'NOASSERTION',
                filesAnalyzed: false,
                licenseConcluded: comp.licenses?.[0]?.license?.name || 'NOASSERTION',
                licenseDeclared: comp.licenses?.[0]?.license?.name || 'NOASSERTION',
                copyrightText: 'NOASSERTION'
            }))
        };
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const outputPath = args[0] || './sbom.json';
    
    const generator = new SBOMGenerator();
    generator.saveToFile(outputPath)
        .then(() => {
            console.log('SBOM generation completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('SBOM generation failed:', error);
            process.exit(1);
        });
}

module.exports = SBOMGenerator;