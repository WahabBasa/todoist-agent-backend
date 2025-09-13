# TaskAI Testing Execution Guide

## How to Run the Comprehensive Tests

This guide provides step-by-step instructions for executing the comprehensive TaskAI tests defined in `comprehensive-system-testing.md`.

---

## Pre-Test Setup Checklist

### 1. Environment Verification
- [ ] TaskAI system is running (`ea-ai-main2/ea-ai-main2/`)
- [ ] Convex backend is deployed and accessible
- [ ] Todoist integration is active with proper OAuth scopes
- [ ] Google Calendar integration is configured (if available)
- [ ] AI model (Claude) is responding correctly

### 2. Baseline Data Setup
- [ ] Create test Todoist projects: "Test Project", "Work Projects", "Home Improvement"
- [ ] Ensure calendar is accessible and not conflicted during test times
- [ ] Document current task/calendar state for comparison

### 3. Testing Tools Ready
- [ ] Access to Todoist web/mobile app for verification
- [ ] Google Calendar interface for cross-checking
- [ ] Test result documentation template ready

---

## Test Execution Phases

## PHASE 1: GENERAL KNOWLEDGE TESTING

### Execute these queries in order and document responses:

**Test T1.1**: General Science
```
Query: "Explain quantum computing in simple terms"
Expected: Clear explanation, no tool usage
Record: Response quality, any inappropriate tool calls
```

**Test T1.2**: Current Events  
```
Query: "What are the latest developments in AI research as of 2025?"
Expected: Current information, contextual awareness
Record: Accuracy of information, date awareness
```

**Test T1.3**: Technology Concepts
```
Query: "How does blockchain technology work?"
Expected: Technical but accessible explanation
Record: Clarity, correctness, engagement level
```

**Test T1.4**: Programming Topics
```
Query: "Explain the differences between React and Vue.js"
Expected: Comparative analysis with examples
Record: Technical accuracy, balanced perspective
```

**Test T1.5**: Creative Task
```
Query: "Help me brainstorm names for a tech startup focused on sustainable energy"
Expected: Creative suggestions, no productivity tools
Record: Creativity, relevance, variety of suggestions
```

**Test T1.6**: Creative Writing
```
Query: "Write a short poem about autumn leaves"
Expected: Original creative content
Record: Literary quality, originality, engagement
```

**Test T1.7**: Problem Solving
```
Query: "How would you solve traffic congestion in a major city like New York?"
Expected: Analytical thinking, multiple solutions
Record: Solution quality, feasibility, creativity
```

**Test T1.8**: Practical Knowledge
```
Query: "Create a simple recipe for chocolate chip cookies that takes under 30 minutes"
Expected: Clear recipe with timing
Record: Practicality, clarity, accuracy
```

### Context & Memory Tests

**Test T1.9**: Multi-turn Conversation
```
Turn 1: "I'm interested in learning photography"
Turn 2: "What camera would you recommend for a beginner?"
Turn 3: "What about lenses? Should I start with just the kit lens?"
Turn 4: "Can you suggest some good photography practice exercises?"
Expected: Contextual continuity, relevant suggestions
Record: Context retention, conversation flow
```

**Test T1.10**: Reference to Earlier Context
```
Earlier: Discuss favorite books
Later: "Based on what I mentioned about my reading preferences, what would you suggest next?"
Expected: Reference to earlier conversation
Record: Memory accuracy, relevant recommendations
```

---

## PHASE 2: TOOL USAGE PROFICIENCY TESTING

### Tool Selection Logic Tests

**Test T2.1**: Basic Task Query
```
Query: "What tasks do I have due today?"
Expected: Uses find-tasks-by-date tool with today's date
Record: Correct tool selection, proper parameters
```

**Test T2.2**: Calendar Scheduling
```
Query: "Schedule a team meeting for next Wednesday at 2 PM"
Expected: Uses calendar/scheduling tools
Record: Tool choice, parameter extraction
```

**Test T2.3**: Task Creation with Due Date
```
Query: "Remind me to call John tomorrow at 3 PM"
Expected: Uses add-tasks tool with due date/time
Record: Correct interpretation of "remind" as task creation
```

**Test T2.4**: Out-of-Scope Query
```
Query: "What's the weather like today?"
Expected: Acknowledges limitation, no tool usage
Record: Appropriate restraint, helpful alternative suggestions
```

### Multi-Tool Workflow Tests

**Test T2.5**: Complex Project Creation
```
Query: "Create a project called 'House Renovation' with these 5 tasks: Plan layout, Get permits, Hire contractor, Buy materials, Start work. Then find a good time this month to start planning."

Expected Flow:
1. add-projects tool to create "House Renovation"  
2. add-tasks tool to create 5 tasks in that project
3. find-tasks-by-date or calendar query to suggest timing

Record: Tool sequence, task creation accuracy, scheduling logic
```

**Test T2.6**: Task Management Workflow
```
Query: "Find all my overdue tasks and reschedule them for next week, keeping them in order of priority"

Expected Flow:
1. find-tasks-by-date with "overdue" parameter
2. update-tasks to modify due dates
3. Proper priority ordering maintained

Record: Overdue task identification, batch updating, priority preservation
```

**Test T2.7**: Recurring Setup
```
Query: "Set up a recurring weekly team review meeting every Friday at 4 PM, and create a task to prepare agenda 2 hours before each meeting"

Expected Flow:
1. Calendar tool for recurring meeting
2. add-tasks for preparation task with timing logic
3. Proper recurring pattern setup

Record: Recurring event creation, linked task creation, timing coordination
```

---

## PHASE 3: DATA ACCURACY & DETAIL MANAGEMENT

### Complex Task Creation Tests

**Test T3.1**: Multi-Attribute Task
```
Query: "Create a high-priority task 'Review Q4 budget' due December 15th at 2 PM with tags 'finance' and 'urgent', assign it to the 'Work Projects' project"

Verification Checklist:
- [ ] Task name: "Review Q4 budget"
- [ ] Priority: High (priority 1 in Todoist)
- [ ] Due date: December 15th, 2025
- [ ] Due time: 2:00 PM  
- [ ] Tags: "finance" AND "urgent"
- [ ] Project: "Work Projects"

Record: Each attribute preserved exactly, cross-check in Todoist
```

**Test T3.2**: Batch Task Creation
```
Query: "Add these tasks to my 'Home Improvement' project:
- Paint living room (priority 2, due next Friday, tag: painting)
- Buy supplies for bathroom renovation (priority 4, due tomorrow, tags: shopping, bathroom)  
- Schedule contractor consultation (priority 1, due this week, tag: contractors)"

Verification for each task:
Task 1: Paint living room
- [ ] Project: "Home Improvement"
- [ ] Priority: 2
- [ ] Due date: Next Friday (calculate exact date)
- [ ] Tag: "painting"

Task 2: Buy supplies for bathroom renovation  
- [ ] Project: "Home Improvement"
- [ ] Priority: 4
- [ ] Due date: Tomorrow (exact date)
- [ ] Tags: "shopping" AND "bathroom"

Task 3: Schedule contractor consultation
- [ ] Project: "Home Improvement" 
- [ ] Priority: 1 (high)
- [ ] Due date: This week (system should pick specific date)
- [ ] Tag: "contractors"

Record: Batch creation accuracy, individual task verification
```

### Calendar Integration Tests

**Test T3.4**: Complex Meeting Creation
```
Query: "Schedule a 90-minute meeting 'Sprint Planning' for next Tuesday at 2 PM, invite team@company.com, set location as Conference Room A, add agenda in description"

Verification Checklist:
- [ ] Event title: "Sprint Planning"
- [ ] Duration: 90 minutes (2:00 PM - 3:30 PM)
- [ ] Date: Next Tuesday (calculate exact date)
- [ ] Attendees: team@company.com
- [ ] Location: "Conference Room A"  
- [ ] Description includes agenda information

Record: Calendar event accuracy, all fields populated correctly
```

### Edge Case & Validation Tests

**Test T3.10**: Invalid Date Handling
```
Query: "Create a task due on February 30th"
Expected: Error detection, helpful correction (suggest Feb 28/29 or March 2)
Record: Error handling quality, suggested alternatives
```

**Test T3.11**: Invalid Time Format
```
Query: "Schedule a meeting for 25:00 today"  
Expected: Time validation error, format guidance
Record: Validation accuracy, user guidance quality
```

---

## RESULTS DOCUMENTATION TEMPLATE

For each test, record:

### Test ID: [T1.1, T2.5, etc.]
**Query**: [Exact user input]
**Expected Outcome**: [What should happen]
**Actual Outcome**: [What actually happened]
**Tools Used**: [List of tool calls with parameters]
**Data Verification**: [Cross-check results in Todoist/Calendar]
**Pass/Fail**: [Met success criteria?]
**Score**: [1-5 rating]
**Notes**: [Observations, issues, improvements needed]

---

## POST-TEST ANALYSIS

After completing all tests:

1. **Calculate Overall Scores**:
   - General Knowledge: Average of T1.1-T1.12
   - Tool Usage: Average of T2.1-T2.12  
   - Data Accuracy: Average of T3.1-T3.14

2. **Identify Patterns**:
   - Which types of queries work best?
   - What tool usage patterns are most effective?
   - Where do data accuracy issues occur?

3. **Priority Issues**:
   - Critical failures that affect core functionality
   - Minor improvements that would enhance user experience

4. **Recommendations**:
   - System configuration adjustments
   - Training data improvements
   - Feature enhancements needed

This systematic approach ensures thorough evaluation of TaskAI's capabilities across all requested dimensions.