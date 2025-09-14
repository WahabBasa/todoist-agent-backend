# OpenTelemetry Tracing Implementation Plan

## 1. Required Dependencies

To implement OpenTelemetry tracing for the AI application, we need to add the following dependencies to `package.json`:

### Core OpenTelemetry Packages:
- `@opentelemetry/sdk-node` - Core SDK for Node.js
- `@opentelemetry/api` - OpenTelemetry API
- `@opentelemetry/sdk-trace-node` - Tracing SDK for Node.js
- `@opentelemetry/exporter-console` - Console exporter for debugging
- `@opentelemetry/resources` - Resources package for service identification
- `@opentelemetry/semantic-conventions` - Semantic conventions for consistent naming
- `@opentelemetry/instrumentation` - Base instrumentation package

### Additional Packages:
- `@opentelemetry/auto-instrumentations-node` - Auto-instrumentation for common libraries

## 2. Directory Structure

Create the following directory structure for the tracing implementation:

```
ea-ai-main2/ea-ai-main2/convex/ai/tracing/
├── index.ts                 # Main tracing module entry point
├── tracer.ts                # Tracer configuration and initialization
├── spans/                   # Span creation utilities
│   ├── messageSpans.ts      # Message exchange tracing
│   ├── promptSpans.ts       # AI prompt tracing
│   └── toolCallSpans.ts     # Tool call tracing
├── exporters/               # Exporter configurations
│   └── consoleExporter.ts   # Console exporter setup
└── utils/                   # Utility functions
    └── spanUtils.ts         # Helper functions for span management
```

## 3. Key Functions and Modules

### Main Tracing Module (index.ts)
- `initializeTracing()` - Initialize the OpenTelemetry SDK
- `shutdownTracing()` - Gracefully shutdown the tracing SDK
- `getTracer()` - Get the configured tracer instance

### Tracer Configuration (tracer.ts)
- `configureTracer()` - Configure the tracer with service name and resource information
- `setupConsoleExporter()` - Setup console exporter for trace output

### Span Creation Utilities
1. **Message Spans (messageSpans.ts)**:
   - `createUserMessageSpan()` - Create span for user messages
   - `createAssistantMessageSpan()` - Create span for assistant responses

2. **Prompt Spans (promptSpans.ts)**:
   - `createPromptSpan()` - Create span for AI model prompts

3. **Tool Call Spans (toolCallSpans.ts)**:
   - `createToolCallSpan()` - Create span for tool calls
   - `createToolResultSpan()` - Create span for tool results

## 4. Integration with Existing Session Management

### Modifications to session.ts:
1. Import tracing utilities at the top of the file
2. Initialize tracing in the `chatWithAI` action handler
3. Create spans for:
   - User messages
   - AI prompts
   - Tool calls
   - Assistant responses
4. Add relevant metadata to spans:
   - Message content (truncated for privacy)
   - Tool names
   - Execution time
   - Model information
   - Session ID
   - User ID

### Integration Points:
1. At the beginning of `chatWithAI` handler:
   - Create conversation span
   - Add session and user context

2. Before sending messages to AI model:
   - Create prompt span
   - Add prompt content and model information

3. During tool execution (in toolRegistry.ts):
   - Create tool call span
   - Add tool name and input parameters
   - Create tool result span
   - Add execution results

4. For assistant responses:
   - Create assistant message span
   - Add response content

## 5. Configuration for Console Output

### Console Exporter Setup:
1. Configure console exporter to output traces in a readable format
2. Set appropriate sampling rates to avoid overwhelming output
3. Format trace output with clear indentation and labeling
4. Include timing information for each span

### Trace Attributes:
- `service.name` - "ea-ai-backend"
- `session.id` - Session identifier
- `user.id` - User identifier (hashed for privacy)
- `model.name` - AI model name
- `tool.name` - Tool name for tool calls
- `message.role` - Role of message (user/assistant/tool)
- `span.kind` - Type of operation

## 6. Implementation Steps

1. Add dependencies to package.json
2. Create tracing directory structure
3. Implement tracer configuration
4. Create span utilities for messages, prompts, and tool calls
5. Integrate tracing into session.ts
6. Integrate tracing into toolRegistry.ts
7. Configure console exporter
8. Test implementation with sample interactions

## 7. Example Usage

```typescript
// In session.ts
import { initializeTracing, createUserMessageSpan, createPromptSpan } from './tracing';

// Initialize tracing
const tracer = initializeTracing();

// Create user message span
const userMessageSpan = createUserMessageSpan({
  sessionId,
  userId,
  message: userMessage
});

// Create prompt span
const promptSpan = createPromptSpan({
  model: modelName,
  prompt: systemPrompt,
  messageCount: cachedMessages.length
});
```

## 8. Privacy Considerations

- Truncate or hash sensitive content in trace attributes
- Avoid logging full message content in production
- Use environment variables to enable/disable tracing
- Consider sampling rates to reduce performance impact