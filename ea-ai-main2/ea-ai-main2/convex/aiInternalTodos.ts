import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";

// Helper function for consistent authentication (tokenIdentifier pattern)
async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }
  return identity.tokenIdentifier;
}

// Todo item schema for validation
const TodoItemSchema = v.object({
  id: v.string(),
  content: v.string(),
  status: v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed"), v.literal("cancelled")),
  priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
});

// Create or update internal todolist for AI agent
export const createInternalTodoList = mutation({
  args: {
    sessionId: v.optional(v.id("chatSessions")),
    todos: v.array(TodoItemSchema),
  },
  handler: async (ctx, args) => {
    const tokenIdentifier = await requireAuth(ctx);

    // Verify session belongs to user if sessionId is provided
    if (args.sessionId) {
      const session = await ctx.db.get(args.sessionId);
      if (!session || session.tokenIdentifier !== tokenIdentifier) {
        throw new ConvexError("Chat session not found or unauthorized");
      }
    }

    // Deactivate any existing active todolists for this session
    const existingTodos = await ctx.db
      .query("aiInternalTodos")
      .withIndex("by_tokenIdentifier_session_active", (q) => 
        q.eq("tokenIdentifier", tokenIdentifier)
         .eq("sessionId", args.sessionId)
         .eq("isActive", true))
      .collect();

    for (const todo of existingTodos) {
      await ctx.db.patch(todo._id, { isActive: false });
    }

    // Create new todolist
    const now = Date.now();
    return await ctx.db.insert("aiInternalTodos", {
      tokenIdentifier,
      sessionId: args.sessionId,
      todos: args.todos,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    });
  },
});

// Update existing internal todolist
export const updateInternalTodos = mutation({
  args: {
    sessionId: v.optional(v.id("chatSessions")),
    todos: v.array(TodoItemSchema),
  },
  handler: async (ctx, args) => {
    const tokenIdentifier = await requireAuth(ctx);

    // Find active todolist for this session
    const existingTodoList = await ctx.db
      .query("aiInternalTodos")
      .withIndex("by_tokenIdentifier_session_active", (q) => 
        q.eq("tokenIdentifier", tokenIdentifier)
         .eq("sessionId", args.sessionId)
         .eq("isActive", true))
      .first();

    if (!existingTodoList) {
      // Create new todolist if none exists
      const now = Date.now();
      return await ctx.db.insert("aiInternalTodos", {
        tokenIdentifier,
        sessionId: args.sessionId,
        todos: args.todos,
        createdAt: now,
        updatedAt: now,
        isActive: true,
      });
    }

    // Update existing todolist
    await ctx.db.patch(existingTodoList._id, {
      todos: args.todos,
      updatedAt: Date.now(),
    });

    return existingTodoList._id;
  },
});

// Get current internal todolist for AI agent
export const getInternalTodos = query({
  args: {
    sessionId: v.optional(v.id("chatSessions")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null; // Return null for unauthenticated requests
    }
    const tokenIdentifier = identity.tokenIdentifier;

    // Find active todolist for this session
    const todoList = await ctx.db
      .query("aiInternalTodos")
      .withIndex("by_tokenIdentifier_session_active", (q) => 
        q.eq("tokenIdentifier", tokenIdentifier)
         .eq("sessionId", args.sessionId)
         .eq("isActive", true))
      .first();

    if (!todoList) {
      return null;
    }

    // Calculate summary statistics
    const todos = todoList.todos;
    const pendingCount = todos.filter(t => t.status === "pending").length;
    const inProgressCount = todos.filter(t => t.status === "in_progress").length;
    const completedCount = todos.filter(t => t.status === "completed").length;
    const totalCount = todos.length;

    return {
      _id: todoList._id,
      todos,
      summary: {
        total: totalCount,
        pending: pendingCount,
        inProgress: inProgressCount,
        completed: completedCount,
        remaining: pendingCount + inProgressCount,
      },
      createdAt: todoList.createdAt,
      updatedAt: todoList.updatedAt,
    };
  },
});

// Clear completed internal todolists (cleanup function)
export const clearCompletedTodos = mutation({
  args: {
    sessionId: v.optional(v.id("chatSessions")),
  },
  handler: async (ctx, args) => {
    const tokenIdentifier = await requireAuth(ctx);

    // Find completed todolists for this session
    const query = ctx.db
      .query("aiInternalTodos")
      .withIndex("by_tokenIdentifier_and_session", (q) => 
        q.eq("tokenIdentifier", tokenIdentifier).eq("sessionId", args.sessionId));

    const todoLists = await query.collect();
    
    let deletedCount = 0;
    for (const todoList of todoLists) {
      // Delete if all todos are completed or cancelled, and it's not the active list
      const allCompleted = todoList.todos.every(t => 
        t.status === "completed" || t.status === "cancelled"
      );
      
      if (allCompleted && !todoList.isActive) {
        await ctx.db.delete(todoList._id);
        deletedCount++;
      }
    }

    return { deletedCount };
  },
});

// Deactivate current todolist (mark as completed)
export const deactivateInternalTodos = mutation({
  args: {
    sessionId: v.optional(v.id("chatSessions")),
  },
  handler: async (ctx, args) => {
    const tokenIdentifier = await requireAuth(ctx);

    // Find active todolist for this session
    const activeList = await ctx.db
      .query("aiInternalTodos")
      .withIndex("by_tokenIdentifier_session_active", (q) => 
        q.eq("tokenIdentifier", tokenIdentifier)
         .eq("sessionId", args.sessionId)
         .eq("isActive", true))
      .first();

    if (activeList) {
      await ctx.db.patch(activeList._id, { 
        isActive: false,
        updatedAt: Date.now(),
      });
      return true;
    }

    return false;
  },
});