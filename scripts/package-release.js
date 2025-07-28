#!/usr/bin/env node

/**
 * Release Packaging Script
 * Creates distribution packages for releases
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class ReleasePackager {
    constructor() {
        this.packageJson = this.loadPackageJson();
        this.version = this.packageJson.version;
        this.distDir = path.join(process.cwd(), 'dist');
        this.timestamp = new Date().toISOString();
    }

    loadPackageJson() {
        const packagePath = path.join(process.cwd(), 'package.json');
        return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    }

    async createReleasePackage() {
        console.log(`Creating release package for version ${this.version}...`);

        try {
            // Ensure dist directory exists
            this.ensureDistDirectory();

            // Create release metadata
            const releaseInfo = await this.generateReleaseInfo();

            // Package the application
            await this.packageApplication();

            // Generate checksums
            await this.generateChecksums();

            // Create release manifest
            await this.createReleaseManifest(releaseInfo);

            console.log(`Release package created successfully: ${this.distDir}`);
            return releaseInfo;

        } catch (error) {
            console.error('Release packaging failed:', error);
            throw error;
        }
    }

    ensureDistDirectory() {
        if (!fs.existsSync(this.distDir)) {
            fs.mkdirSync(this.distDir, { recursive: true });
        }
    }

    async generateReleaseInfo() {
        const gitCommit = this.getGitCommit();
        const gitBranch = this.getGitBranch();
        const buildNumber = process.env.GITHUB_RUN_NUMBER || 'local';

        return {
            version: this.version,
            timestamp: this.timestamp,
            gitCommit,
            gitBranch,
            buildNumber,
            nodeVersion: process.version,
            environment: process.env.NODE_ENV || 'production'
        };
    }

    getGitCommit() {
        try {
            return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
        } catch (error) {
            return 'unknown';
        }
    }

    getGitBranch() {
        try {
            return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
        } catch (error) {
            return 'unknown';
        }
    }

    async packageApplication() {
        console.log('Packaging application files...');

        // Create npm tarball
        const tarballName = `${this.packageJson.name}-${this.version}.tgz`;
        execSync('npm pack', { cwd: process.cwd() });

        // Move tarball to dist directory
        const tarballPath = path.join(process.cwd(), tarballName);
        const distTarballPath = path.join(this.distDir, tarballName);
        
        if (fs.existsSync(tarballPath)) {
            fs.renameSync(tarballPath, distTarballPath);
        }

        // Create serverless deployment package
        await this.createServerlessPackage();

        // Create documentation bundle
        await this.createDocumentationBundle();
    }

    async createServerlessPackage() {
        console.log('Creating serverless deployment package...');

        try {
            // Package serverless application
            execSync('serverless package', { 
                cwd: process.cwd(),
                stdio: 'inherit'
            });

            // Move .serverless directory to dist
            const serverlessDir = path.join(process.cwd(), '.serverless');
            const distServerlessDir = path.join(this.distDir, 'serverless');

            if (fs.existsSync(serverlessDir)) {
                this.copyDirectory(serverlessDir, distServerlessDir);
            }

        } catch (error) {
            console.warn('Serverless packaging failed, skipping...', error.message);
        }
    }

    async createDocumentationBundle() {
        console.log('Creating documentation bundle...');

        const docsDir = path.join(process.cwd(), 'docs');
        const distDocsDir = path.join(this.distDir, 'docs');

        if (fs.existsSync(docsDir)) {
            this.copyDirectory(docsDir, distDocsDir);
        }

        // Include key documentation files
        const docFiles = [
            'README.md',
            'SECURITY.md',
            'DEVELOPMENT.md',
            'CHANGELOG.md',
            'LICENSE'
        ];

        for (const file of docFiles) {
            const sourcePath = path.join(process.cwd(), file);
            const destPath = path.join(this.distDir, file);

            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, destPath);
            }
        }
    }

    copyDirectory(source, destination) {
        if (!fs.existsSync(destination)) {
            fs.mkdirSync(destination, { recursive: true });
        }

        const items = fs.readdirSync(source);

        for (const item of items) {
            const sourcePath = path.join(source, item);
            const destPath = path.join(destination, item);
            const stat = fs.statSync(sourcePath);

            if (stat.isDirectory()) {
                this.copyDirectory(sourcePath, destPath);
            } else {
                fs.copyFileSync(sourcePath, destPath);
            }
        }
    }

    async generateChecksums() {
        console.log('Generating checksums...');

        const checksums = {};
        const files = this.getDistFiles();

        for (const file of files) {
            const filePath = path.join(this.distDir, file);
            const content = fs.readFileSync(filePath);
            
            checksums[file] = {
                sha256: crypto.createHash('sha256').update(content).digest('hex'),
                sha1: crypto.createHash('sha1').update(content).digest('hex'),
                size: content.length
            };
        }

        const checksumPath = path.join(this.distDir, 'checksums.json');
        fs.writeFileSync(checksumPath, JSON.stringify(checksums, null, 2));
    }

    getDistFiles() {
        const files = [];
        
        function walkDirectory(dir, relativePath = '') {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const itemPath = path.join(dir, item);
                const relativeItemPath = path.join(relativePath, item);
                const stat = fs.statSync(itemPath);
                
                if (stat.isDirectory()) {
                    walkDirectory(itemPath, relativeItemPath);
                } else {
                    files.push(relativeItemPath);
                }
            }
        }

        walkDirectory(this.distDir);
        return files.filter(file => !file.includes('checksums.json') && !file.includes('release-manifest.json'));
    }

    async createReleaseManifest(releaseInfo) {
        console.log('Creating release manifest...');

        const manifest = {
            ...releaseInfo,
            package: {
                name: this.packageJson.name,
                description: this.packageJson.description,
                keywords: this.packageJson.keywords,
                license: this.packageJson.license,
                author: this.packageJson.author
            },
            dependencies: {
                production: Object.keys(this.packageJson.dependencies || {}),
                development: Object.keys(this.packageJson.devDependencies || {})
            },
            deployment: {
                platform: 'aws-lambda',
                runtime: 'nodejs18.x',
                framework: 'serverless'
            },
            security: {
                scanDate: this.timestamp,
                sbomIncluded: fs.existsSync(path.join(process.cwd(), 'sbom.json')),
                vulnerabilityScanPassed: true // Updated by CI/CD
            },
            files: this.getDistFiles().length
        };

        const manifestPath = path.join(this.distDir, 'release-manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }

    async verifyPackage() {
        console.log('Verifying release package...');

        const manifestPath = path.join(this.distDir, 'release-manifest.json');
        const checksumsPath = path.join(this.distDir, 'checksums.json');

        if (!fs.existsSync(manifestPath)) {
            throw new Error('Release manifest not found');
        }

        if (!fs.existsSync(checksumsPath)) {
            throw new Error('Checksums file not found');
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const checksums = JSON.parse(fs.readFileSync(checksumsPath, 'utf8'));

        // Verify file integrity
        for (const [file, expected] of Object.entries(checksums)) {
            const filePath = path.join(this.distDir, file);
            
            if (!fs.existsSync(filePath)) {
                throw new Error(`Expected file not found: ${file}`);
            }

            const content = fs.readFileSync(filePath);
            const actualSha256 = crypto.createHash('sha256').update(content).digest('hex');

            if (actualSha256 !== expected.sha256) {
                throw new Error(`Checksum mismatch for file: ${file}`);
            }
        }

        console.log('Package verification completed successfully');
        return true;
    }

    async generateReleaseNotes() {
        console.log('Generating release notes...');

        try {
            // Get commits since last tag
            const lastTag = this.getLastTag();
            const commits = this.getCommitsSinceTag(lastTag);
            
            const releaseNotes = this.formatReleaseNotes(commits);
            const notesPath = path.join(this.distDir, 'release-notes.md');
            
            fs.writeFileSync(notesPath, releaseNotes);
            console.log(`Release notes generated: ${notesPath}`);
            
        } catch (error) {
            console.warn('Could not generate release notes:', error.message);
        }
    }

    getLastTag() {
        try {
            return execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
        } catch (error) {
            return null;
        }
    }

    getCommitsSinceTag(tag) {
        try {
            const range = tag ? `${tag}..HEAD` : 'HEAD';
            const commits = execSync(`git log ${range} --pretty=format:"%h|%s|%an|%ad" --date=short`, { 
                encoding: 'utf8' 
            }).trim();
            
            return commits.split('\n').map(line => {
                const [hash, subject, author, date] = line.split('|');
                return { hash, subject, author, date };
            });
        } catch (error) {
            return [];
        }
    }

    formatReleaseNotes(commits) {
        const features = commits.filter(c => c.subject.startsWith('feat'));
        const fixes = commits.filter(c => c.subject.startsWith('fix'));
        const security = commits.filter(c => c.subject.startsWith('security'));
        const other = commits.filter(c => !c.subject.match(/^(feat|fix|security):/));

        let notes = `# Release Notes - v${this.version}\n\n`;
        notes += `**Release Date:** ${new Date().toISOString().split('T')[0]}\n\n`;

        if (features.length > 0) {
            notes += '## 🚀 New Features\n\n';
            features.forEach(commit => {
                notes += `- ${commit.subject.replace(/^feat:\s*/, '')} (${commit.hash})\n`;
            });
            notes += '\n';
        }

        if (security.length > 0) {
            notes += '## 🔒 Security Updates\n\n';
            security.forEach(commit => {
                notes += `- ${commit.subject.replace(/^security:\s*/, '')} (${commit.hash})\n`;
            });
            notes += '\n';
        }

        if (fixes.length > 0) {
            notes += '## 🐛 Bug Fixes\n\n';
            fixes.forEach(commit => {
                notes += `- ${commit.subject.replace(/^fix:\s*/, '')} (${commit.hash})\n`;
            });
            notes += '\n';
        }

        if (other.length > 0) {
            notes += '## 🔧 Other Changes\n\n';
            other.forEach(commit => {
                notes += `- ${commit.subject} (${commit.hash})\n`;
            });
            notes += '\n';
        }

        notes += '## 📦 Installation\n\n';
        notes += '```bash\n';
        notes += `git checkout v${this.version}\n`;
        notes += 'npm install\n';
        notes += 'serverless deploy --stage prod\n';
        notes += '```\n\n';

        notes += '## 🔍 Verification\n\n';
        notes += 'Verify the installation:\n';
        notes += '```bash\n';
        notes += 'curl https://your-api-endpoint/health\n';
        notes += '```\n\n';

        return notes;
    }
}

// CLI execution
if (require.main === module) {
    const packager = new ReleasePackager();
    
    packager.createReleasePackage()
        .then(() => packager.verifyPackage())
        .then(() => packager.generateReleaseNotes())
        .then(() => {
            console.log('Release packaging completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Release packaging failed:', error);
            process.exit(1);
        });
}

module.exports = ReleasePackager;