# Design Document - Repository Cleanup

## Overview

This design outlines the approach for cleaning up and reorganizing the CDK Cost Analyzer repository. The cleanup will consolidate documentation into a `docs/` folder, organize test artifacts appropriately, remove obsolete files, and ensure compliance with all steering guidelines. The goal is to create a professional, well-organized repository structure that follows Node.js/TypeScript best practices.

## Architecture

The cleanup is a structural reorganization task that involves:

1. **File Analysis**: Identify all files in the repository and categorize them
2. **Documentation Consolidation**: Move supplementary docs to `docs/` folder
3. **Test Artifact Organization**: Move or remove manual test files
4. **Obsolete File Removal**: Remove files that are no longer needed
5. **Reference Updates**: Update any links or references to moved files
6. **Validation**: Ensure all steering guidelines are followed

## Components and Interfaces

### File Categories

The repository files fall into these categories:

1. **Essential Root Files** (keep in root):
   - `README.md` - Main project documentation
   - `package.json`, `package-lock.json` - NPM configuration
   - `tsconfig.json` - TypeScript configuration
   - `vitest.config.mts` - Test configuration
   - `.gitignore` - Git configuration

2. **Supplementary Documentation** (move to `docs/`):
   - `IMPLEMENTATION.md` - Technical implementation details
   - `NEXT-STEPS.md` - Project status and next steps

3. **Test Artifacts** (organize or remove):
   - `test-api.js` - Manual test script
   - `base.json`, `target.json` - Simple test templates
   - `complex-base.json`, `complex-target.json` - Complex test templates
   - `verify-structure.sh` - Verification script

4. **Test Projects** (keep as-is):
   - `test-cdk-project/` - Complete test CDK project with its own documentation

5. **Source and Build** (keep as-is):
   - `src/` - Source code
   - `test/` - Automated tests
   - `dist/` - Build output
   - `node_modules/` - Dependencies

6. **Configuration Directories** (keep as-is):
   - `.kiro/` - Kiro configuration and specs
   - `.git/` - Git repository data

## Data Models

### Repository Structure (Before)

```
cdk-cost-analyzer/
├── README.md
├── IMPLEMENTATION.md          ← Move to docs/
├── NEXT-STEPS.md             ← Move to docs/
├── package.json
├── tsconfig.json
├── vitest.config.mts
├── test-api.js               ← Move to examples/ or remove
├── base.json                 ← Move to examples/
├── target.json               ← Move to examples/
├── complex-base.json         ← Move to examples/
├── complex-target.json       ← Move to examples/
├── verify-structure.sh       ← Evaluate if needed
├── src/
├── test/
├── test-cdk-project/
├── dist/
├── node_modules/
└── .kiro/
```

### Repository Structure (After)

```
cdk-cost-analyzer/
├── README.md
├── package.json
├── tsconfig.json
├── vitest.config.mts
├── .gitignore
├── docs/
│   ├── IMPLEMENTATION.md
│   └── DEVELOPMENT.md        ← Renamed from NEXT-STEPS.md
├── examples/
│   ├── simple/
│   │   ├── base.json
│   │   └── target.json
│   ├── complex/
│   │   ├── base.json
│   │   └── target.json
│   └── api-usage.js          ← Renamed from test-api.js
├── src/
├── test/
├── test-cdk-project/
├── dist/
├── node_modules/
└── .kiro/
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After reviewing the prework analysis, several properties can be consolidated:

- Properties 1.4 and 5.3 are identical (no files with backup/temp suffixes) - keep as one property
- Properties 2.3 and 3.4 both check link validity - combine into one comprehensive property
- Properties 3.3 and 4.5 both check file preservation - combine into one property about preserving functional files

The remaining properties provide unique validation value and should be kept.

### Correctness Properties

Property 1: No temporary or backup file suffixes
*For any* file in the repository, the filename should not contain suffixes like `_backup`, `_old`, `_fixed`, `_clean`, `_temp`, or similar temporary naming patterns
**Validates: Requirements 1.4, 5.3**

Property 2: All documentation links are valid
*For any* markdown file in the repository, all internal links (links to other files in the repository) should point to files that exist
**Validates: Requirements 2.3, 3.4**

Property 3: Functional files are preserved
*For any* file in `src/`, `test/`, or configuration files (package.json, tsconfig.json, vitest.config.mts, .gitignore) that existed before cleanup, that file should still exist after cleanup
**Validates: Requirements 3.3, 4.5**

Note: Most acceptance criteria in this feature are about specific final states (examples) rather than universal properties, which is appropriate for a one-time cleanup task. The properties above capture the key invariants that should hold across all files.

## Error Handling

### File Operations

- **Missing files**: If a file to be moved doesn't exist, log a warning and continue
- **Permission errors**: If a file cannot be moved due to permissions, report error and stop
- **Existing destinations**: If destination file already exists, report error and ask for confirmation

### Link Updates

- **Broken links found**: Report all broken links before making changes
- **Ambiguous paths**: If a link could refer to multiple files, report and ask for clarification
- **External links**: Do not modify external links (http://, https://)

### Validation

- **Steering guideline violations**: Report any violations found but don't block cleanup
- **Structure issues**: Report if expected directories are missing

## Testing Strategy

### Manual Verification

Since this is a one-time cleanup task, testing will primarily be manual verification:

1. **Before Cleanup Snapshot**: Document current repository state
2. **Execute Cleanup**: Perform file moves and deletions
3. **Verify Structure**: Check that new structure matches design
4. **Verify Links**: Check that all documentation links work
5. **Verify Build**: Run `npm run build` to ensure nothing broke
6. **Verify Tests**: Run `npm test` to ensure tests still pass
7. **Verify CLI**: Test CLI functionality with examples

### Property-Based Tests

While this is a cleanup task, we can write simple verification scripts:

- **Property 1 Test**: Script to find files with temporary suffixes
- **Property 2 Test**: Script to validate all markdown links
- **Property 3 Test**: Script to compare file lists before/after

These scripts can be run after cleanup to verify correctness.

### Checklist Validation

After cleanup, verify:

- [ ] Root directory contains only essential files
- [ ] All supplementary docs are in `docs/`
- [ ] README.md is in root
- [ ] Test artifacts are in `examples/` or removed
- [ ] No files with temporary suffixes exist
- [ ] All markdown links are valid
- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] CLI works with example files
- [ ] Test project documentation is unchanged
- [ ] No duplicate files exist

## Implementation Approach

### Phase 1: Preparation

1. Create new directory structure (`docs/`, `examples/`)
2. Document current file locations for reference
3. Identify all files to be moved or removed

### Phase 2: Documentation Consolidation

1. Create `docs/` folder
2. Move `IMPLEMENTATION.md` to `docs/IMPLEMENTATION.md`
3. Rename and move `NEXT-STEPS.md` to `docs/DEVELOPMENT.md`
4. Update any links in README.md that reference moved files

### Phase 3: Test Artifact Organization

1. Create `examples/` folder with `simple/` and `complex/` subdirectories
2. Move `base.json` and `target.json` to `examples/simple/`
3. Move `complex-base.json` and `complex-target.json` to `examples/complex/`
4. Rename and move `test-api.js` to `examples/api-usage.js`
5. Update script to reference new example file locations
6. Evaluate `verify-structure.sh` - remove if obsolete

### Phase 4: Documentation Updates

1. Update README.md to reference new file locations
2. Update `docs/IMPLEMENTATION.md` if it references moved files
3. Update `docs/DEVELOPMENT.md` to reflect new structure
4. Update `examples/api-usage.js` to use new paths

### Phase 5: Validation

1. Run link validation script
2. Run build: `npm run build`
3. Run tests: `npm test`
4. Test CLI with examples
5. Verify no temporary files exist
6. Review against steering guidelines

### Phase 6: Documentation

1. Update README.md with new structure information
2. Add examples section showing how to use files in `examples/`
3. Update any references to file locations

## Steering Guideline Compliance

### Development Standards (development-standards.md)

✅ **No duplicate files with suffixes**: Property 1 ensures this
✅ **Clean directory structure**: New structure is organized and logical
✅ **Documentation approach**: Single comprehensive README with supplementary docs in `docs/`
✅ **File management**: No temporary or backup files

### Documentation Style (documentation-style.md)

✅ **Professional tone**: Existing documentation already follows this
✅ **Clear structure**: Documentation will be organized in `docs/` folder
✅ **No emojis**: Existing docs comply (except NEXT-STEPS.md which will be reviewed)

### TypeScript Best Practices (typescript-best-practices.md)

✅ **Project structure**: Source in `src/`, tests in `test/`, follows conventions
✅ **Configuration files**: All in root as expected

### Testing Best Practices (testing-best-practices.md)

✅ **Test organization**: Automated tests in `test/`, examples separate
✅ **Clear separation**: Production code, tests, and examples are distinct

## Success Criteria

The cleanup is successful when:

1. Root directory contains only essential files (README, package files, configs)
2. All supplementary documentation is in `docs/` folder
3. All test artifacts are in `examples/` folder or removed
4. No files with temporary suffixes exist
5. All markdown links are valid and working
6. `npm run build` completes successfully
7. `npm test` passes all tests
8. CLI works correctly with example files
9. Repository structure follows all steering guidelines
10. Git history preserves all removed files
