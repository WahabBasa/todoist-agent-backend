import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { ConvexError } from "convex/values";

// Big-brain pattern: User context validation and access control
// This ensures proper user data separation and prevents cross-user data access

/**
 * Get the current authenticated user's context (for queries and mutations)
 * Following big-brain pattern from documents.ts:hasAccessToDocument
 */
export async function getUserContext(
  ctx: QueryCtx | MutationCtx
): Promise<{ userId: string } | null> {
  const identity = await ctx.auth.getUserIdentity();
  
  if (!identity?.tokenIdentifier) {
    return null;
  }
  
  return {
    userId: identity.tokenIdentifier
  };
}

/**
 * Get user context for actions (no database access, just auth check)
 */
export async function getUserContextForAction(
  ctx: ActionCtx
): Promise<{ userId: string } | null> {
  const identity = await ctx.auth.getUserIdentity();
  
  if (!identity?.tokenIdentifier) {
    return null;
  }
  
  return {
    userId: identity.tokenIdentifier
  };
}

/**
 * Require authentication and return user context (for queries and mutations)
 * Throws ConvexError if user is not authenticated
 */
export async function requireUserAuth(
  ctx: QueryCtx | MutationCtx
): Promise<{ userId: string }> {
  const userContext = await getUserContext(ctx);
  
  if (!userContext) {
    throw new ConvexError("Authentication required. Please sign in to access your data.");
  }
  
  return userContext;
}

/**
 * Require authentication for actions (no database access)
 * Throws ConvexError if user is not authenticated
 */
export async function requireUserAuthForAction(
  ctx: ActionCtx
): Promise<{ userId: string }> {
  const userContext = await getUserContextForAction(ctx);
  
  if (!userContext) {
    throw new ConvexError("Authentication required. Please sign in to access your data.");
  }
  
  return userContext;
}

/**
 * Check if user has an active Todoist connection (for queries and mutations)
 * Following big-brain pattern for access control
 */
export async function hasActiveTodoistConnection(
  ctx: QueryCtx | MutationCtx,
  userId: string
): Promise<boolean> {
  try {
    const tokenRecord = await ctx.db
      .query("todoistTokens")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", userId))
      .unique();
    
    return tokenRecord !== null && tokenRecord.accessToken.length > 0;
  } catch (error) {
    console.error("Error checking Todoist connection:", error);
    return false;
  }
}

/**
 * Require active Todoist connection and return user context (for queries and mutations)
 * Throws ConvexError if user doesn't have Todoist connected
 */
export async function requireTodoistConnection(
  ctx: QueryCtx | MutationCtx
): Promise<{ userId: string }> {
  const userContext = await requireUserAuth(ctx);
  
  const hasConnection = await hasActiveTodoistConnection(ctx, userContext.userId);
  
  if (!hasConnection) {
    throw new ConvexError(
      "Todoist not connected. Please connect your Todoist account to use task management features."
    );
  }
  
  return userContext;
}

/**
 * Get user's Todoist token with proper access control (for queries and mutations)
 * Returns null if user doesn't have access or token doesn't exist
 */
export async function getUserTodoistToken(
  ctx: QueryCtx | MutationCtx,
  userId: string
): Promise<string | null> {
  try {
    const tokenRecord = await ctx.db
      .query("todoistTokens")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", userId))
      .unique();
    
    return tokenRecord?.accessToken || null;
  } catch (error) {
    console.error("Error retrieving Todoist token:", error);
    return null;
  }
}

/**
 * Validate that data belongs to the requesting user
 * Prevents cross-user data access for external API responses
 */
export function validateDataOwnership(
  requestingUserId: string,
  dataUserId: string,
  dataType: string = "data"
): void {
  if (requestingUserId !== dataUserId) {
    throw new ConvexError(
      `Access denied. You don't have permission to access this ${dataType}.`
    );
  }
}

/**
 * Create user-scoped filter for external API data
 * Ensures all returned data belongs to the requesting user
 */
export function createUserScopedFilter<T extends { userId?: string; tokenIdentifier?: string }>(
  userId: string
): (item: T) => boolean {
  return (item: T) => {
    return item.userId === userId || item.tokenIdentifier === userId;
  };
}

/**
 * Log user access for debugging and security monitoring
 * Following security best practices for multi-user applications
 */
export function logUserAccess(
  userId: string,
  action: string,
  resource: string,
  success: boolean = true
): void {
  const logLevel = success ? "info" : "warn";
  console[logLevel](`[USER_ACCESS] ${userId.substring(0, 20)}... ${action} ${resource} - ${success ? "SUCCESS" : "FAILED"}`);
}