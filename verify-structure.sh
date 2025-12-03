#!/bin/bash

echo "=== CDK Cost Analyzer Structure Verification ==="
echo ""

# Check source files
echo "📁 Source Files:"
find src -type f -name "*.ts" | wc -l | xargs echo "  Total TypeScript files:"

# Check test files
echo ""
echo "🧪 Test Files:"
find test -type f -name "*.ts" | wc -l | xargs echo "  Total test files:"

# Check configuration
echo ""
echo "⚙️  Configuration Files:"
ls -1 package.json tsconfig.json vitest.config.ts .gitignore README.md 2>/dev/null | wc -l | xargs echo "  Found:"

# Check directory structure
echo ""
echo "📂 Directory Structure:"
echo "  src/"
ls -d src/*/ 2>/dev/null | sed 's|src/||' | sed 's|^|    - |'
echo "  test/"
ls -d test/*/ 2>/dev/null | sed 's|test/||' | sed 's|^|    - |'

echo ""
echo "✅ Structure verification complete!"
