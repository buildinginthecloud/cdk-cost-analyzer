#!/bin/bash

# Verification script for repository cleanup
# Run this after dependencies are installed

set -e

echo "=== CDK Cost Analyzer - Repository Cleanup Verification ==="
echo ""

# Check directory structure
echo "1. Checking directory structure..."
if [ -d "docs" ] && [ -d "examples/simple" ] && [ -d "examples/complex" ]; then
    echo "   ✓ Directory structure created correctly"
else
    echo "   ✗ Directory structure incomplete"
    exit 1
fi

# Check moved files
echo "2. Checking documentation files..."
if [ -f "docs/IMPLEMENTATION.md" ] && [ -f "docs/DEVELOPMENT.md" ]; then
    echo "   ✓ Documentation files moved correctly"
else
    echo "   ✗ Documentation files missing"
    exit 1
fi

# Check example files
echo "3. Checking example files..."
if [ -f "examples/simple/base.json" ] && [ -f "examples/simple/target.json" ] && \
   [ -f "examples/complex/base.json" ] && [ -f "examples/complex/target.json" ] && \
   [ -f "examples/api-usage.js" ]; then
    echo "   ✓ Example files organized correctly"
else
    echo "   ✗ Example files missing"
    exit 1
fi

# Check obsolete files removed
echo "4. Checking obsolete files removed..."
if [ ! -f "verify-structure.sh" ] && [ ! -f "NEXT-STEPS.md" ] && \
   [ ! -f "IMPLEMENTATION.md" ] && [ ! -f "test-api.js" ]; then
    echo "   ✓ Obsolete files removed"
else
    echo "   ✗ Some obsolete files still present"
    exit 1
fi

# Check root directory cleanliness
echo "5. Checking root directory..."
ROOT_FILES=$(ls -1 | wc -l)
if [ $ROOT_FILES -le 10 ]; then
    echo "   ✓ Root directory is clean ($ROOT_FILES items)"
else
    echo "   ⚠ Root directory has $ROOT_FILES items (may include node_modules)"
fi

# Install dependencies if needed
echo ""
echo "6. Installing dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
fi

# Build project
echo ""
echo "7. Building project..."
npm run build

# Run tests
echo ""
echo "8. Running tests (including property tests)..."
npm test

# Test CLI
echo ""
echo "9. Testing CLI with new example paths..."
node dist/cli/index.js examples/simple/base.json examples/simple/target.json --region eu-central-1

# Test API
echo ""
echo "10. Testing API usage script..."
cd examples && node api-usage.js && cd ..

echo ""
echo "=== All verifications passed! ==="
echo ""
echo "Repository cleanup completed successfully:"
echo "  • Documentation moved to docs/"
echo "  • Examples organized in examples/"
echo "  • Property tests added"
echo "  • Build successful"
echo "  • All tests passing"
echo "  • CLI and API working with new paths"
