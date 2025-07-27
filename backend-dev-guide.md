# Backend Planning Guide: From API Requirements to Implementation

## Core Engineering Considerations

Before diving into planning levels, keep four fundamental questions in mind for any backend:

**Data Integrity** - How do you ensure data stays consistent when multiple users are reading/writing simultaneously? Which operations can happen concurrently and which need coordination?

**Performance Under Load** - How do you keep things fast when serving one user versus thousands? Unlike frontend where performance affects one device, backend performance affects everyone.

**Failure Isolation** - When something breaks, how do you prevent it from cascading and taking down the whole system? How do you gracefully handle external service failures?

**Security Boundaries** - Who can access what data and perform which operations? How do you verify and authorize each request without blocking legitimate users?

These aren't patterns you implement - they're questions every backend architectural decision must answer.

## The Planning Levels

### Level 1: API Requirements Mapping
**Always start here. Never skip.**

Map out what your frontend actually needs from your backend at each step of the user's journey. Focus on the data flow and real-time requirements, not just the feature list.

**Key Questions:**
- What data does the frontend need and when?
- Which operations need to be fast vs. which can be async?
- What needs to work offline and sync later?
- Where do you need real-time updates vs. polling?
- What external services do you need to integrate?

**Context Filtering:** This is where your constraints automatically eliminate options. "Real-time chat backend for offline-capable mobile app with AI integration, small user base, solo developer using TypeScript" filters out 90% of possible approaches.

### Level 2: API Boundary Design
**Use common sense reasoning - think through natural groupings**

Decide which operations belong together and which should be separate. Use intuitive reasoning about data relationships and user workflows.

**Key Reasoning Patterns:**
- Should authentication be separate from core features? (Usually no - everything needs auth)
- Should real-time operations be separate from batch operations? (Usually yes - different performance needs)
- Should external service integrations be isolated? (Usually yes - they can fail independently)
- Do related data types need to be updated together? (Group them in the same service boundary)

**Red Flag:** Don't create boundaries just for code organization. Create them based on operational requirements and failure isolation needs.

### Level 3: Operational Function Definition
**Be explicit about the distinct pieces you're building**

Break down your API boundaries into specific functions, mutations, queries, and background processes. Name them clearly and define their responsibilities.

**Function Categories:**
- **Immediate user operations** - Store data, return quickly, trigger background work
- **Data retrieval queries** - Get user data for frontend display
- **Background processing** - Heavy computations, external API calls, batch operations
- **Real-time subscriptions** - Live data streams to frontend
- **System maintenance** - Cleanup, monitoring, health checks

### Level 4: Data Relationship Planning
**Never skip this. This determines your database design and consistency requirements.**

Map out how your data entities relate to each other and how changes propagate through the system.

**Critical Decisions:**
- What's your single source of truth for each piece of data?
- How do related entities stay in sync when updated?
- What happens when operations fail partway through?
- How do you handle concurrent updates to the same data?
- What data needs to be denormalized for performance?

### Level 5: System Architecture Patterns
**Choose patterns that solve problems revealed by earlier levels**

Now select specific architectural approaches based on the constraints and requirements you've identified.

**Common Backend Patterns:**
- **Event-driven architecture** - Operations trigger other operations asynchronously
- **CQRS (Command Query Responsibility Segregation)** - Separate read and write operations
- **Background job processing** - Queue heavy work for async execution
- **Database transactions** - Ensure multi-step operations complete atomically
- **Caching strategies** - Store frequently accessed data in memory
- **Connection pooling** - Reuse database connections efficiently
- **Circuit breakers** - Prevent cascading failures from external services
- **Rate limiting** - Control request volume per user/endpoint

### Level 6: Implementation Techniques
**Apply specific coding practices and optimization techniques**

**Data Access Patterns:**
- Query optimization (indexes, avoiding N+1 queries)
- Batch operations (group related database calls)
- Lazy loading (fetch related data only when needed)

**Error Handling Techniques:**
- Input validation and sanitization
- Graceful degradation (partial functionality when services fail)
- Retry logic with exponential backoff
- Comprehensive logging and monitoring

**Security Implementation:**
- Authentication and authorization middleware
- Data encryption (at rest and in transit)
- SQL injection and XSS prevention
- API rate limiting and abuse prevention

## When to Skip Levels

**Skip API Boundary Design when:**
- Your backend is simple CRUD operations
- All operations have similar performance and reliability requirements
- You're building a prototype or MVP

**Skip System Architecture Patterns when:**
- Your user base is small (< 1000 active users)
- Your data relationships are simple
- You're using a framework that handles most complexity (like Convex, Supabase)

**Never skip:**
- API requirements mapping (drives everything else)
- Data relationship planning (prevents consistency disasters)

## Red Flags: You're Overengineering

- Creating microservices for a simple application
- Implementing complex caching before you have performance problems
- Building elaborate authentication systems for low-stakes applications
- Planning for scale you won't reach for years
- Separating services that always need to work together
- Implementing patterns because they're "best practices" rather than solving actual problems

## The Context Filter Effect

Your specific context automatically eliminates most options:

**"Personal productivity app, 100 users, solo developer, TypeScript/Convex" eliminates:**
- Microservices architectures
- Complex distributed systems
- Advanced caching strategies
- Elaborate CI/CD pipelines
- Multi-region deployment
- Complex authentication systems

**And makes obvious choices feel natural:**
- Simple function-based API design
- Built-in real-time features
- Basic error handling
- Single database with straightforward schema
- Standard authentication patterns

## The Engineering Mindset

Backend engineering is about building reliable, performant infrastructure that serves frontend needs while managing system-wide concerns. Each level should reveal specific problems that the next level solves.

The goal isn't to follow every level religiously - it's to make deliberate decisions about where complexity is necessary and where it isn't. Your current context (user scale, team size, technical constraints) should filter 90% of possible approaches automatically.

Remember: you're engineering for both individual user experiences AND system-wide reliability. This dual context makes backend architecture decisions more complex than frontend, but also more systematic once you understand your actual constraints.