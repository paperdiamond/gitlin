# Testing gitlin

This document tracks testing and dogfooding efforts.

## Manual Testing Checklist

- [ ] Comment `/create-issues` on a PR with simple task list
- [ ] Verify Linear issues are created with correct priority
- [ ] Test with commit messages containing follow-up items
- [ ] Test dependency linking between issues
- [ ] Verify effort estimation is applied correctly
- [ ] Verify emoji reactions appear (👀 processing, 🚀 success, 😕 error)

## Dogfooding

We use gitlin to manage gitlin's own development. This ensures we experience the same workflow as our users.

## Test Results

### 2025-12-03 - Initial dogfooding attempt
- Fixed GitHub verification 403 error
- Added emoji reaction support
