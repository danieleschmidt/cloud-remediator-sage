#!/bin/bash

# Autonomous Backlog Management Runner
# Run this script to execute the autonomous backlog management system

set -e

echo "🤖 Starting Autonomous Backlog Management"
echo "=========================================="

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ to continue."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run quality checks first
echo "🔍 Running quality checks..."
npm test

# Run the autonomous system
echo "🚀 Starting autonomous execution..."
npm run backlog

echo "✅ Autonomous execution completed!"
echo ""
echo "📊 Check docs/status/ for reports and metrics"
echo "📋 Review backlog.yml for updated item statuses"