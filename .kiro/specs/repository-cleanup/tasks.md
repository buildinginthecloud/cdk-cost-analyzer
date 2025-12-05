# Implementation Plan

- [ ] 1. Create new directory structure
  - Create `docs/` folder in repository root
  - Create `examples/` folder in repository root
  - Create `examples/simple/` subdirectory
  - Create `examples/complex/` subdirectory
  - _Requirements: 1.1, 1.2, 3.5_

- [ ] 2. Move supplementary documentation to docs folder
  - Move `IMPLEMENTATION.md` to `docs/IMPLEMENTATION.md`
  - Rename and move `NEXT-STEPS.md` to `docs/DEVELOPMENT.md`
  - Review `docs/DEVELOPMENT.md` for any emojis or casual language and update to follow documentation-style.md
  - _Requirements: 2.1, 2.2, 5.1_

- [ ] 3. Organize test artifacts into examples folder
  - Move `base.json` to `examples/simple/base.json`
  - Move `target.json` to `examples/simple/target.json`
  - Move `complex-base.json` to `examples/complex/base.json`
  - Move `complex-target.json` to `examples/complex/target.json`
  - Rename and move `test-api.js` to `examples/api-usage.js`
  - Update `examples/api-usage.js` to reference new file paths (`./simple/base.json`, `./simple/target.json`)
  - _Requirements: 3.1, 3.2, 3.5_

- [ ] 4. Evaluate and remove obsolete files
  - Check if `verify-structure.sh` is still needed
  - Remove `verify-structure.sh` if it's obsolete
  - _Requirements: 4.1, 4.3_

- [ ] 5. Update documentation references
  - Update README.md to add "Documentation" section referencing docs folder
  - Update README.md "Quick Start" examples to reference new example file paths
  - Update README.md "Programmatic Usage" example to reference `examples/api-usage.js`
  - Check `docs/IMPLEMENTATION.md` for any references to moved files and update paths
  - Check `docs/DEVELOPMENT.md` for any references to moved files and update paths
  - _Requirements: 2.3, 3.4_

- [ ] 6. Update test project documentation references
  - Review `test-cdk-project/README.md` for any references to root-level files
  - Update any paths in test project docs if needed
  - Ensure test project documentation remains in place
  - _Requirements: 2.5_

- [ ] 6.1 Write property test for no temporary file suffixes
  - **Property 1: No temporary or backup file suffixes**
  - **Validates: Requirements 1.4, 5.3**

- [ ] 6.2 Write property test for valid documentation links
  - **Property 2: All documentation links are valid**
  - **Validates: Requirements 2.3, 3.4**

- [ ] 6.3 Write property test for functional file preservation
  - **Property 3: Functional files are preserved**
  - **Validates: Requirements 3.3, 4.5**

- [ ] 7. Checkpoint - Verify repository structure and functionality
  - Ensure all tests pass, ask the user if questions arise
  - Verify `npm run build` succeeds
  - Verify `npm test` passes
  - Test CLI with example files: `node dist/cli/index.js examples/simple/base.json examples/simple/target.json --region eu-central-1`
  - Test API usage script: `node examples/api-usage.js`
  - Verify root directory contains only essential files
  - Verify no files with temporary suffixes exist
  - _Requirements: 1.1, 1.4, 3.3, 4.5_
