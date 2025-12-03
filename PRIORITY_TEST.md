# Priority Level Test Cases

This file contains test cases to validate priority assignment. Each case should map to its specific priority level.

## Test Case 1: URGENT Priority
**Scenario**: The entire production website is returning 500 errors and all users are completely blocked from accessing the site.

**Expected**: Priority = urgent

## Test Case 2: HIGH Priority
**Scenario**: The login button is completely broken - no users can log in at all, blocking access to core functionality.

**Expected**: Priority = high

## Test Case 3: MEDIUM Priority
**Scenario**: Payment processing times out for amounts over $1000, causing some transactions to fail. Users can retry and it works on second attempt.

**Expected**: Priority = medium

## Test Case 4: LOW Priority
**Scenario**: Add keyboard shortcuts (Ctrl+K) to improve navigation speed. This would be a nice enhancement but isn't fixing any bugs.

**Expected**: Priority = low
