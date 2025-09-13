# TaskAI Comprehensive System Testing Framework

## Overview
This document outlines a comprehensive testing approach for TaskAI to evaluate:
1. **General Query Handling** - Non-productivity related queries
2. **Tool Usage Proficiency** - Agent's effectiveness with available tools
3. **Data Accuracy & Detail Management** - Complex operations with Todoist/Calendar

## Test Environment Setup
- **System**: TaskAI Production Environment
- **Testing Date**: September 13, 2025
- **Todoist Integration**: Active with OAuth scope verification
- **Google Calendar Integration**: Available for scheduling tests
- **AI Model**: Claude 3.5 Sonnet with tool calling capabilities

---

## 1. GENERAL KNOWLEDGE TESTING

### 1.1 Science & Technology Questions
**Purpose**: Test system's ability to handle non-productivity queries

#### Test Cases:
- **T1.1**: "Explain quantum computing in simple terms"
- **T1.2**: "What are the latest developments in AI research as of 2025?"
- **T1.3**: "How does blockchain technology work?"
- **T1.4**: "Explain the differences between React and Vue.js"

**Expected Behavior**: Provide accurate, helpful responses without attempting to use productivity tools

### 1.2 Creative & Problem-Solving Tasks
#### Test Cases:
- **T1.5**: "Help me brainstorm names for a tech startup"
- **T1.6**: "Write a short poem about autumn"
- **T1.7**: "How would you solve traffic congestion in a major city?"
- **T1.8**: "Create a simple recipe for chocolate chip cookies"

**Expected Behavior**: Engage creatively while maintaining personality consistency

### 1.3 Conversational Context & Memory
#### Test Cases:
- **T1.9**: Multi-turn conversation about a hobby (e.g., photography)
- **T1.10**: Reference earlier parts of conversation
- **T1.11**: Handle topic transitions naturally
- **T1.12**: Maintain context across tool usage

**Expected Behavior**: Demonstrate natural conversation flow and context retention

---

## 2. TOOL USAGE PROFICIENCY TESTING

### 2.1 Tool Selection Logic
**Purpose**: Verify agent chooses appropriate tools for given tasks

#### Test Cases:
- **T2.1**: "What tasks do I have due today?" → Should use Todoist tools
- **T2.2**: "Schedule a meeting for next week" → Should use Calendar tools
- **T2.3**: "Remind me to call John tomorrow at 3 PM" → Should create task with due date
- **T2.4**: "What's the weather like?" → Should recognize limitation/redirect

**Expected Behavior**: Logical tool selection based on user intent

### 2.2 Multi-Tool Workflows
#### Test Cases:
- **T2.5**: "Create a project for house renovation with 5 key tasks, then schedule time to work on them"
- **T2.6**: "Find all my overdue tasks and reschedule them for this week"
- **T2.7**: "Set up a recurring weekly review meeting and create a task to prepare for it"
- **T2.8**: "Look at my calendar and suggest the best time to add a 2-hour deep work block"

**Expected Behavior**: Smooth chaining of tools with logical flow

### 2.3 Error Handling & Recovery
#### Test Cases:
- **T2.9**: Provide invalid project ID reference
- **T2.10**: Request creation of task with impossible due date
- **T2.11**: Try to schedule meeting in the past
- **T2.12**: Reference non-existent calendar or task

**Expected Behavior**: Graceful error handling with helpful guidance

---

## 3. DATA ACCURACY & DETAIL MANAGEMENT TESTING

### 3.1 Complex Task Creation
**Purpose**: Test precision with multiple task attributes

#### Test Cases:
- **T3.1**: "Create a high-priority task 'Review Q4 budget' due December 15th at 2 PM with tags 'finance' and 'urgent', assign it to the 'Work Projects' project"

- **T3.2**: "Add these tasks to my 'Home Improvement' project:
  - Paint living room (priority 2, due next Friday, tag: painting)  
  - Buy supplies for bathroom renovation (priority 4, due tomorrow, tags: shopping, bathroom)
  - Schedule contractor consultation (priority 1, due this week, tag: contractors)"

- **T3.3**: "Create a recurring task 'Team standup notes' that repeats every weekday at 9 AM, high priority, in my 'Work' project with tag 'meetings'"

**Expected Behavior**: Perfect preservation of all specified details

### 3.2 Calendar Integration Complexity
#### Test Cases:
- **T3.4**: "Schedule a 90-minute meeting 'Sprint Planning' for next Tuesday at 2 PM, invite team@company.com, set location as Conference Room A, add agenda in description"

- **T3.5**: "Create a recurring weekly 1:1 with my manager every Thursday at 3 PM for the next 8 weeks, with reminder 30 minutes before"

- **T3.6**: "Block my calendar for 'Deep Work - Project X' every day next week from 9-11 AM, mark as busy, add note about no interruptions"

**Expected Behavior**: Accurate scheduling with all specified parameters

### 3.3 Batch Operations & Data Consistency
#### Test Cases:
- **T3.7**: "Update all tasks in my 'Q4 Goals' project to have priority 2 and add the tag 'quarter-end'"

- **T3.8**: "Find all tasks due this week and reschedule them to next week, keeping the same time but moving the date forward 7 days"

- **T3.9**: "Create 5 tasks for my morning routine: 
  - Review calendar (7 AM daily, priority 3)
  - Check emails (7:15 AM daily, priority 2)  
  - Review daily tasks (7:30 AM daily, priority 1)
  - Team sync preparation (8 AM daily, priority 2)
  - Coffee break (8:30 AM daily, priority 4)"

**Expected Behavior**: Consistent application of changes across multiple items

### 3.4 Edge Cases & Validation
#### Test Cases:
- **T3.10**: "Create a task due on February 30th" (invalid date)
- **T3.11**: "Schedule a meeting for 25:00 today" (invalid time)
- **T3.12**: "Set priority level 6 for this task" (invalid priority range)
- **T3.13**: "Create task in project 'XYZ-NonExistent'" (invalid project)
- **T3.14**: "Schedule meeting across timezone boundary during DST change"

**Expected Behavior**: Intelligent validation with helpful corrections

---

## 4. TESTING EXECUTION PROTOCOL

### Phase 1: Baseline Testing
1. Execute general knowledge tests (T1.1-T1.12)
2. Document response quality and tool usage patterns
3. Note any inappropriate tool calls

### Phase 2: Tool Proficiency Assessment  
1. Execute tool selection and workflow tests (T2.1-T2.12)
2. Monitor tool call sequences and decision logic
3. Evaluate error handling effectiveness

### Phase 3: Data Accuracy Validation
1. Execute complex data tests (T3.1-T3.14)
2. Verify exact preservation of user specifications
3. Cross-check results in Todoist and Calendar interfaces

### Phase 4: Stress Testing
1. Combine multiple test categories in single conversations
2. Test system behavior under high complexity scenarios
3. Evaluate performance degradation points

---

## 5. SUCCESS CRITERIA & METRICS

### General Knowledge (Weight: 25%)
- **Accuracy**: Factually correct responses (>90%)
- **Relevance**: On-topic and helpful (>95%)
- **Tool Restraint**: No inappropriate productivity tool usage (100%)

### Tool Usage (Weight: 35%)
- **Selection Logic**: Correct tool choice (>90%)
- **Workflow Efficiency**: Optimal tool sequencing (>85%)
- **Error Recovery**: Graceful failure handling (>95%)

### Data Accuracy (Weight: 40%)
- **Detail Preservation**: All specified attributes captured (>98%)
- **Consistency**: Data integrity across platforms (>99%)
- **Validation**: Proper error detection (>95%)

---

## 6. DOCUMENTATION & REPORTING

Each test execution will be documented with:
- **Input**: Exact user query
- **Expected Outcome**: Predicted system behavior
- **Actual Outcome**: What actually happened
- **Tool Calls**: Sequence and parameters used
- **Data Verification**: Cross-check with actual Todoist/Calendar
- **Pass/Fail**: Whether test met success criteria
- **Notes**: Observations and improvements needed

This framework ensures comprehensive evaluation of TaskAI's capabilities across all dimensions requested.