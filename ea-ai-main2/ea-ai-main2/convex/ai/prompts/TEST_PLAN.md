# Test Plan for Direct Command Execution

## Test Cases

### 1. Direct Command Execution
**Input**: "wipe all tasks in my todoist"
**Expected Behavior**: 
- Primary agent should delegate to execution subagent immediately
- Execution subagent should execute the command without asking for approval
- System should report the results of the operation

### 2. User Authority Assertion
**Input**: "do not question me and do what I asked for"
**Followed by**: "delete all tasks"
**Expected Behavior**:
- Primary agent should recognize the user authority assertion
- Primary agent should delegate to execution subagent immediately
- Execution subagent should execute the command without asking for approval
- System should report the results of the operation

### 3. Planning Request
**Input**: "organize my tasks"
**Expected Behavior**:
- Primary agent should delegate to planning subagent
- Planning subagent should create a detailed plan
- Primary agent should present the plan to the user for approval
- User should be able to approve or request modifications
- Once approved, primary agent should delegate to execution subagent
- System should report the results of the operation

### 4. User Confirmation
**Input**: "organize my tasks"
**System Response**: "I've created a detailed plan for organizing your tasks. Would you like me to proceed with executing this plan?"
**User Response**: "yes"
**Expected Behavior**:
- Primary agent should recognize the user confirmation as final approval
- Primary agent should delegate to execution subagent immediately
- Execution subagent should execute the plan without asking for additional approval
- System should report the results of the operation

## Verification Points

### Prompt Loading
- [ ] Execution subagent loads `execution-prompt.ts` correctly
- [ ] Planning subagent loads `planning-prompt.ts` correctly
- [ ] General subagent loads `general-prompt.ts` correctly
- [ ] Primary agent loads `zen.ts` correctly

### Direct Command Handling
- [ ] Direct commands are delegated to execution subagent immediately
- [ ] Execution subagent executes commands without asking for approval
- [ ] User authority assertions are respected
- [ ] User confirmations are treated as final approval

### Planning Request Handling
- [ ] Planning requests are delegated to planning subagent
- [ ] Plans are presented to users for approval
- [ ] User modifications are handled correctly
- [ ] Approved plans are executed through execution subagent

### Error Handling
- [ ] Technical validation errors are handled gracefully
- [ ] API errors are handled with retries
- [ ] Partial success scenarios are reported correctly
- [ ] Network errors are handled appropriately

## Rollback Plan

If issues are encountered:
1. Revert the prompt files to their original content
2. Restore the original task tool implementation
3. Review the error logs to identify the root cause
4. Implement a more targeted fix

## Success Criteria

- [ ] Direct commands execute immediately without approval
- [ ] User authority assertions are respected
- [ ] User confirmations are treated as final approval
- [ ] Planning requests still require approval
- [ ] System reports accurate results for all operations
- [ ] No regression in existing functionality