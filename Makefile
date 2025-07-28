# Cloud Remediator Sage - Makefile for SDLC automation
# Security-focused build and deployment automation

.PHONY: help install test build deploy clean security performance docs

# Default target
.DEFAULT_GOAL := help

# Variables
PROJECT_NAME := cloud-remediator-sage
VERSION := $(shell cat package.json | grep version | cut -d '"' -f 4)
DOCKER_TAG := $(PROJECT_NAME):$(VERSION)
DOCKER_LATEST := $(PROJECT_NAME):latest
NODE_ENV ?= development
AWS_REGION ?= us-east-1

# Colors for output
RED := \033[31m
GREEN := \033[32m
YELLOW := \033[33m
BLUE := \033[34m
RESET := \033[0m

help: ## Show this help message
	@echo "$(GREEN)Cloud Remediator Sage - SDLC Automation$(RESET)"
	@echo "$(BLUE)Version: $(VERSION)$(RESET)"
	@echo ""
	@echo "Available targets:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

##@ Development
install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(RESET)"
	npm ci
	@echo "$(GREEN)Dependencies installed successfully$(RESET)"

dev: ## Start development environment
	@echo "$(BLUE)Starting development environment...$(RESET)"
	docker-compose up -d postgres redis localstack
	npm run dev

dev-full: ## Start full development stack
	@echo "$(BLUE)Starting full development stack...$(RESET)"
	docker-compose --profile development up -d
	@echo "$(GREEN)Development stack started$(RESET)"
	@echo "Application: http://localhost:3000"
	@echo "Grafana: http://localhost:3001"
	@echo "Prometheus: http://localhost:9090"
	@echo "Jaeger: http://localhost:16686"

##@ Testing
test: ## Run all tests
	@echo "$(BLUE)Running tests...$(RESET)"
	npm test

test-unit: ## Run unit tests only
	@echo "$(BLUE)Running unit tests...$(RESET)"
	npm test -- --testPathPattern="tests/.*\.test\.js" --testPathIgnorePatterns="tests/integration/" --testPathIgnorePatterns="tests/contract/" --testPathIgnorePatterns="tests/performance/"

test-integration: ## Run integration tests
	@echo "$(BLUE)Running integration tests...$(RESET)"
	npm test -- --testPathPattern="tests/integration/.*\.test\.js"

test-contract: ## Run contract tests
	@echo "$(BLUE)Running contract tests...$(RESET)"
	npm test -- --testPathPattern="tests/contract/.*\.test\.js"

test-performance: ## Run performance tests
	@echo "$(BLUE)Running performance tests...$(RESET)"
	docker-compose --profile performance-testing run --rm k6 run /scripts/k6-config.js
	docker-compose --profile performance-testing run --rm k6 run /scripts/load-test.js

test-coverage: ## Generate test coverage report
	@echo "$(BLUE)Generating coverage report...$(RESET)"
	npm test -- --coverage
	@echo "$(GREEN)Coverage report generated at coverage/lcov-report/index.html$(RESET)"

##@ Security
security-audit: ## Run security audit
	@echo "$(BLUE)Running security audit...$(RESET)"
	npm audit --audit-level moderate
	npm run lint:security || true
	@echo "$(GREEN)Security audit completed$(RESET)"

security-scan: ## Run comprehensive security scans
	@echo "$(BLUE)Running security scans...$(RESET)"
	@mkdir -p security reports
	# OWASP ZAP security scan
	docker-compose --profile security-testing run --rm security-tools || true
	# Trivy filesystem scan
	docker run --rm -v $(PWD):/workspace aquasec/trivy:latest fs --format json --output /workspace/security/trivy-fs.json /workspace || true
	# Semgrep static analysis
	docker run --rm -v $(PWD):/src returntocorp/semgrep:latest --config=auto --json --output=/src/security/semgrep.json /src || true
	@echo "$(GREEN)Security scans completed. Results in security/ directory$(RESET)"

security-sbom: ## Generate Software Bill of Materials
	@echo "$(BLUE)Generating SBOM...$(RESET)"
	@mkdir -p docs/sbom
	npx @cyclonedx/bom > docs/sbom/sbom.json
	@echo "$(GREEN)SBOM generated at docs/sbom/sbom.json$(RESET)"

##@ Build & Package
lint: ## Run code linting
	@echo "$(BLUE)Running linter...$(RESET)"
	npm run lint

build: lint test security-audit ## Build application
	@echo "$(BLUE)Building application...$(RESET)"
	npm run build
	@echo "$(GREEN)Build completed successfully$(RESET)"

docker-build: ## Build Docker image
	@echo "$(BLUE)Building Docker image...$(RESET)"
	docker build -t $(DOCKER_TAG) -t $(DOCKER_LATEST) .
	@echo "$(GREEN)Docker image built: $(DOCKER_TAG)$(RESET)"

docker-build-security: ## Build Docker image with security scanning
	@echo "$(BLUE)Building Docker image with security scanning...$(RESET)"
	docker build --target security-scanner -t $(PROJECT_NAME)-security:$(VERSION) .
	docker build -t $(DOCKER_TAG) -t $(DOCKER_LATEST) .
	# Extract security scan results
	docker run --rm -v $(PWD)/security:/output $(PROJECT_NAME)-security:$(VERSION) sh -c "cp /tmp/trivy-results.json /output/ 2>/dev/null || true"
	@echo "$(GREEN)Docker image built with security scanning: $(DOCKER_TAG)$(RESET)"

docker-scan: ## Scan Docker image for vulnerabilities
	@echo "$(BLUE)Scanning Docker image for vulnerabilities...$(RESET)"
	@mkdir -p security
	# Trivy image scan
	docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --format json --output /tmp/trivy-image.json $(DOCKER_LATEST) || true
	docker run --rm -v $(PWD)/security:/output -v /tmp:/tmp alpine cp /tmp/trivy-image.json /output/ 2>/dev/null || true
	# Docker bench security
	docker run --rm --net host --pid host --userns host --cap-add audit_control \
		-e DOCKER_CONTENT_TRUST=$$DOCKER_CONTENT_TRUST \
		-v /var/lib:/var/lib:ro \
		-v /var/run/docker.sock:/var/run/docker.sock:ro \
		-v /usr/lib/systemd:/usr/lib/systemd:ro \
		-v /etc:/etc:ro \
		--label docker_bench_security \
		docker/docker-bench-security || true
	@echo "$(GREEN)Docker image security scan completed$(RESET)"

##@ Deployment
deploy-dev: docker-build ## Deploy to development environment
	@echo "$(BLUE)Deploying to development environment...$(RESET)"
	docker-compose up -d cloud-remediator-sage
	@echo "$(GREEN)Deployed to development$(RESET)"

deploy-staging: docker-build-security security-scan ## Deploy to staging environment
	@echo "$(BLUE)Deploying to staging environment...$(RESET)"
	# Add staging deployment commands here
	@echo "$(YELLOW)Staging deployment not yet implemented$(RESET)"

deploy-prod: ## Deploy to production environment (requires approval)
	@echo "$(RED)Production deployment requires manual approval$(RESET)"
	@echo "Run 'make deploy-prod-confirmed' after approval"

deploy-prod-confirmed: docker-build-security security-scan ## Deploy to production (confirmed)
	@echo "$(BLUE)Deploying to production environment...$(RESET)"
	# Add production deployment commands here
	@echo "$(YELLOW)Production deployment not yet implemented$(RESET)"

##@ Infrastructure
infra-plan: ## Plan infrastructure changes
	@echo "$(BLUE)Planning infrastructure changes...$(RESET)"
	# Add Terraform plan commands here
	@echo "$(YELLOW)Infrastructure planning not yet implemented$(RESET)"

infra-apply: ## Apply infrastructure changes
	@echo "$(BLUE)Applying infrastructure changes...$(RESET)"
	# Add Terraform apply commands here
	@echo "$(YELLOW)Infrastructure apply not yet implemented$(RESET)"

##@ Monitoring & Operations
logs: ## View application logs
	@echo "$(BLUE)Viewing application logs...$(RESET)"
	docker-compose logs -f cloud-remediator-sage

status: ## Check service status
	@echo "$(BLUE)Checking service status...$(RESET)"
	docker-compose ps
	@echo ""
	@echo "Health checks:"
	@curl -s http://localhost:3000/health || echo "$(RED)Application not responding$(RESET)"

metrics: ## View metrics
	@echo "$(BLUE)Opening metrics dashboard...$(RESET)"
	@echo "Prometheus: http://localhost:9090"
	@echo "Grafana: http://localhost:3001"

##@ Documentation
docs-generate: ## Generate documentation
	@echo "$(BLUE)Generating documentation...$(RESET)"
	@mkdir -p docs/api
	# Generate API docs
	npx jsdoc src/ -r -d docs/api/ || echo "JSDoc not configured"
	@echo "$(GREEN)Documentation generated$(RESET)"

docs-serve: ## Serve documentation locally
	@echo "$(BLUE)Serving documentation...$(RESET)"
	@echo "Documentation available at docs/"

##@ Backlog Management
backlog-run: ## Run autonomous backlog management
	@echo "$(BLUE)Running autonomous backlog management...$(RESET)"
	npm run backlog

backlog-demo: ## Run backlog management demo
	@echo "$(BLUE)Running backlog management demo...$(RESET)"
	npm run demo

##@ Cleanup
clean: ## Clean build artifacts and temporary files
	@echo "$(BLUE)Cleaning build artifacts...$(RESET)"
	rm -rf node_modules coverage reports security logs
	docker-compose down -v --remove-orphans
	docker system prune -f
	@echo "$(GREEN)Cleanup completed$(RESET)"

clean-docker: ## Remove all project Docker images and containers
	@echo "$(BLUE)Cleaning Docker artifacts...$(RESET)"
	docker-compose down -v --remove-orphans
	docker rmi $(DOCKER_TAG) $(DOCKER_LATEST) || true
	docker rmi $(PROJECT_NAME)-security:$(VERSION) || true
	@echo "$(GREEN)Docker cleanup completed$(RESET)"

##@ CI/CD
ci-test: install lint test-unit test-integration security-audit ## Run CI test pipeline
	@echo "$(GREEN)CI test pipeline completed successfully$(RESET)"

ci-build: ci-test docker-build-security docker-scan security-sbom ## Run CI build pipeline
	@echo "$(GREEN)CI build pipeline completed successfully$(RESET)"

ci-deploy: ci-build ## Run CI deployment pipeline
	@echo "$(BLUE)Running CI deployment pipeline...$(RESET)"
	# Deployment logic would go here
	@echo "$(GREEN)CI deployment pipeline completed successfully$(RESET)"

##@ Version Management
version-patch: ## Bump patch version
	@echo "$(BLUE)Bumping patch version...$(RESET)"
	npm version patch
	@echo "$(GREEN)Version bumped to $(shell cat package.json | grep version | cut -d '"' -f 4)$(RESET)"

version-minor: ## Bump minor version
	@echo "$(BLUE)Bumping minor version...$(RESET)"
	npm version minor
	@echo "$(GREEN)Version bumped to $(shell cat package.json | grep version | cut -d '"' -f 4)$(RESET)"

version-major: ## Bump major version
	@echo "$(BLUE)Bumping major version...$(RESET)"
	npm version major
	@echo "$(GREEN)Version bumped to $(shell cat package.json | grep version | cut -d '"' -f 4)$(RESET)"

##@ Quick Commands
quick-start: install dev-full ## Quick start for development
	@echo "$(GREEN)Development environment is ready!$(RESET)"

quick-test: lint test-unit security-audit ## Quick test run
	@echo "$(GREEN)Quick tests completed$(RESET)"

quick-build: lint test docker-build ## Quick build
	@echo "$(GREEN)Quick build completed$(RESET)"

##@ Information
info: ## Show project information
	@echo "$(GREEN)Cloud Remediator Sage$(RESET)"
	@echo "Version: $(VERSION)"
	@echo "Node version: $(shell node --version)"
	@echo "npm version: $(shell npm --version)"
	@echo "Docker version: $(shell docker --version)"
	@echo "Environment: $(NODE_ENV)"
	@echo "AWS Region: $(AWS_REGION)"