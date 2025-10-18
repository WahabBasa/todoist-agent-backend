## Time Parsing Rules Implementation & Auto-Conversion Discovery (22:45)

**Status**: ✅ Execution agent updated with intelligent time parsing; anomaly identified

### Problem Investigated
User confirmed setting household chores from **10 AM to 3 PM**, but Google Calendar showed **2 PM to 7 PM** instead (5-hour offset observed).

### Root Cause Analysis
Discovered execution agent was NOT parsing flexible time formats before passing to calendar tool:
- Tool promised natural language support ("2pm") but implementation does `new Date("2pm")` → fails
- Execution agent had no time parsing logic in detail_extraction stage
- Issue: "10 am" string passed directly to tool instead of ISO format "2025-10-20T10:00:00Z"

### Changes Made

**convex/ai/prompts/execution_new.ts** - Added comprehensive time parsing section:

1. **time_parsing section** (85 lines): Complete flexible time format support
   - 12-hour with am/pm: "10 am", "3:30 pm"
   - Military/24-hour: "1400", "0930"
   - Spelled out: "10 o'clock", "half past 2"
   - Special times: "noon", "midnight"
   - Step-by-step parsing algorithm with date context handling
   - Duration parsing for end time calculation
   - 5 detailed examples

2. **detail_extraction section** (updated): 
   - startDate now explicitly: "Parse time from plan using time_parsing rules above, convert to ISO format"
   - endDate/duration: Reference time_parsing rules for extraction

3. **tool_call_patterns** (updated):
   - Added comment: "# Use time_parsing rules above to convert plan times to ISO format"
   - ISO examples now include Z suffix for UTC clarity

4. **time_conversion_requirement** (new):
   - Critical reminder that all calendar times MUST be pre-converted to ISO using parsing rules
   - Fallback instruction: ask for exact ISO time if conversion fails

### Key Discovery: Automatic Time Conversion Logic Exists

**IMPORTANT**: Despite adding time parsing rules to execution agent, when tested with "10 am to 3 pm" specification, the SAME INCORRECT TIME (2 PM to 7 PM) was still created in calendar.

**Hypothesis**: There appears to be automatic time conversion logic somewhere in the system that is systematically applying a +4 hour offset:
- User specifies: 10 AM → Created as: 2 PM
- User specifies: 3 PM → Created as: 7 PM
- Offset pattern: +4 hours consistently

**Possible locations**:
1. Google Calendar backend (auth.ts createCalendarEvent function)
2. Browser timezone context handling in getCurrentTime
3. Timezone conversion middleware between execution and backend
4. Implicit UTC conversion without timezone context

**Status**: NOT FIXED - Per user request, documenting anomaly for investigation, not attempting fix.

### Architecture Clarification

The execution agent now has explicit instructions for:
1. Recognizing flexible user input ("10 am", "3 o'clock", "0900", etc.)
2. Computing dates relative to current time (tomorrow, next Monday, etc.)
3. Converting all times to ISO format before tool calls
4. Graceful fallback if conversion is ambiguous

However, the downstream time conversion suggests additional validation/debugging needed at the backend or timezone layer.

### Next Steps (For Future Investigation)

1. Trace createCalendarEvent in auth.ts to see if timezone conversion is happening
2. Check getCurrentTime timezone context vs user's actual timezone
3. Verify Google Calendar API calls include correct timezone info
4. Consider adding logging to show time values at each stage (parsing → ISO → backend → API call)

### Files Modified
- `convex/ai/prompts/execution_new.ts` - 244 line net additions for time parsing logic

### Testing Note
Execution agent now SHOULD parse flexible times correctly. If calendar still shows wrong times, issue is downstream of the execution agent (in tool implementation or timezone handling).
