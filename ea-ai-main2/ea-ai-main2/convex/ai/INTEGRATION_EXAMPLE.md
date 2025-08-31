# Event-Driven Processor Integration

## How to Replace Old Streaming with New Event System

### Current Code in `ai.ts` (OLD)

```typescript
// OLD PATTERN - Record patching with type casting
for await (const part of result.fullStream) {
  switch (part.type) {
    case 'text-delta':
      accumulatedText += part.text;
      // ❌ Constant database updates
      if (accumulatedText.length % 20 === 0 || part.text === '\n') {
        await (ctx.runMutation as any)("streamingResponses.updateStreamingResponse", {
          streamId,
          partialContent: accumulatedText,
          isComplete: false,
        });
      }
      break;

    case 'tool-call':
      // ❌ More record patching
      await (ctx.runMutation as any)("streamingResponses.updateStreamingResponse", {
        streamId,
        partialContent: accumulatedText,
        toolCalls: toolCallsExecuted,
      });
      break;
  }
}
```

### New Integration (CLEAN)

```typescript
// NEW PATTERN - Import the event processor
import { processWithHybrid } from "./ai/eventDrivenProcessor";

// Replace the entire streaming loop with one function call
const result = await processWithHybrid(
  ctx,                    // ✅ ActionCtx (no casting)
  sessionId,             // ✅ Clean parameters
  tokenIdentifier,       // ✅ Type-safe
  streamId,
  message,
  modelName,
  messageId,
  modelMessages,         // ✅ Existing model messages
  plannerTools,         // ✅ Existing tools
  mentalModelContent    // ✅ Optional mental model
);

// ✅ Clean result handling
if (result.success) {
  console.log(`Stream completed: ${result.eventsPublished} events published`);
  console.log(`Final content: ${result.finalContent.slice(0, 100)}...`);
} else {
  console.error(`Stream failed: ${result.error}`);
}
```

---

## Step-by-Step Migration

### Step 1: Update Import Section

```typescript
// Add to top of ai.ts
import { 
  processWithHybrid, 
  processWithEvents,
  ProcessingResult 
} from "./ai/eventDrivenProcessor";
```

### Step 2: Replace Streaming Loop

**Replace this entire section:**
```typescript
// DELETE: Old streaming pattern (lines ~1290-1380)
let accumulatedText = '';
let toolCallsExecuted: any[] = [];
let toolResultsAccumulated: any[] = [];

try {
  for await (const part of result.fullStream) {
    // ... 100+ lines of streaming logic
  }
  
  // ... completion logic
} catch (error) {
  // ... error handling
}
```

**With this clean replacement:**
```typescript
// REPLACE WITH: Event-driven processing
const processingResult: ProcessingResult = await processWithHybrid(
  ctx,
  sessionId || 'unknown',
  tokenIdentifier,
  streamId,
  message,
  modelName,
  messageId,
  modelMessages,
  plannerTools,
  mentalModelContent
);

if (!processingResult.success) {
  throw new Error(processingResult.error || 'AI processing failed');
}

// Extract results for conversation history
const finalText = processingResult.finalContent;
const finalToolCalls = processingResult.toolCallsExecuted;
const finalToolResults = processingResult.toolResultsGenerated;
```

### Step 3: Update Conversation History

```typescript
// This part can remain mostly the same
const newHistory = [
  ...history,
  {
    role: "assistant",
    content: finalText,
    toolCalls: finalToolCalls?.map((tc: any) => ({
      name: tc.toolName,
      args: tc.args, 
      toolCallId: tc.toolCallId
    })),
    toolResults: finalToolResults?.map((tr: any) => ({
      toolCallId: tr.toolCallId,
      toolName: tr.toolName,
      result: tr.result
    })),
    timestamp: Date.now(),
  }
];
```

---

## Benefits of Migration

### Before vs After

| Aspect | Old Pattern | New Pattern |
|--------|------------|-------------|
| **Code Lines** | ~150+ lines of streaming logic | ~10 lines of function call |
| **Type Safety** | Multiple `(as any)` casts | Zero type casting |
| **Database Ops** | 50+ updates to same record | Discrete event inserts |
| **Error Handling** | Scattered throughout loop | Centralized in processor |
| **Tool Integration** | Direct mutation calls | Pure functions + orchestrator |
| **Testing** | Hard to mock streaming | Easy to test components |
| **Maintenance** | Complex, tightly coupled | Clean, separated concerns |

### Performance Improvements

1. **Reduced Database Pressure**: Events are appended, not constantly updated
2. **Better Caching**: Convex can cache event queries efficiently  
3. **Parallel Processing**: Orchestrator can handle side effects in parallel
4. **Memory Efficiency**: No need to accumulate large text strings

### Architecture Benefits

1. **Separation of Concerns**: AI logic separate from database operations
2. **Event Sourcing**: Complete audit trail of all streaming operations
3. **Real-time Updates**: Frontend gets discrete events, not polling
4. **Scalability**: Event system scales better than record updates
5. **Debugging**: Each event is traceable and inspectable

---

## Migration Modes

### 1. Hybrid Mode (Recommended for Migration)

```typescript
// Uses both event system (primary) and legacy (compatibility)
const result = await processWithHybrid(...);
```

- ✅ Event system provides new functionality
- ✅ Legacy system maintains existing frontend compatibility
- ✅ Gradual migration without breaking changes
- ✅ Performance monitoring and comparison

### 2. Events Only (Target State)

```typescript  
// Pure event system (after frontend migration)
const result = await processWithEvents(...);
```

- ✅ Maximum performance and scalability
- ✅ Clean architecture with no legacy code
- ✅ Full OpenCode-inspired event sourcing
- ⚠️ Requires frontend migration first

### 3. Legacy Only (Fallback)

```typescript
// Existing system (no changes)
// Keep current code as fallback
```

- ⚠️ Maintains current limitations
- ❌ No performance improvements
- ❌ Type casting workarounds remain
- ✅ Zero risk during transition

---

## Testing the Migration

### 1. Validate Event Publishing

```typescript
// Check that events are being published
const streamState = await ctx.runQuery("streamEvents.getStreamState", { 
  streamId 
});
console.log(`Events published: ${streamState?.totalEvents}`);
```

### 2. Compare Legacy vs Events

```typescript
// Get data from both systems
const legacyData = await ctx.runQuery("streamingResponses.getStreamingResponse", { 
  streamId 
});
const eventData = await ctx.runQuery("streamEvents.reconstructStreamContent", { 
  streamId 
});

// Compare final content
console.log('Legacy:', legacyData?.partialContent?.length);
console.log('Events:', eventData?.finalContent?.length);
```

### 3. Performance Monitoring

```typescript
const startTime = Date.now();
const result = await processWithHybrid(...);
console.log(`Processing took ${result.totalProcessingTime}ms`);
console.log(`Published ${result.eventsPublished} events`);
```

The new architecture provides a solid foundation for scalable, maintainable AI streaming!