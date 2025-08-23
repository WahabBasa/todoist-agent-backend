import { internalMutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { UserJSON } from "@clerk/backend";
import { v, Validator, ConvexError } from "convex/values";

export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON & { tokenIdentifier: string }> }, // no runtime validation, trust Clerk
  async handler(ctx, { data }) {
    const userAttributes = {
      name: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || "Anonymous User",
      // Use tokenIdentifier for consistent user identification
      externalId: data.tokenIdentifier,
    };

    const user = await userByExternalId(ctx, data.tokenIdentifier);
    if (user === null) {
      await ctx.db.insert("users", userAttributes);
    } else {
      await ctx.db.patch(user._id, userAttributes);
    }
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  async handler(ctx, { clerkUserId }) {
    const user = await userByExternalId(ctx, clerkUserId);

    if (user !== null) {
      await ctx.db.delete(user._id);
    } else {
      console.warn(
        `Can't delete user, there is none for Clerk user ID: ${clerkUserId}`,
      );
    }
  },
});

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  const userRecord = await getCurrentUser(ctx);
  if (!userRecord) throw new Error("Can't get current user");
  return userRecord;
}

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }
  // Use tokenIdentifier for consistent user identification across all functions
  return await userByExternalId(ctx, identity.tokenIdentifier);
}

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("byExternalId", (q) => q.eq("externalId", externalId))
    .unique();
}

// Big-brain style auth helpers for consistent authentication patterns
export async function getUserIdentityOrThrow(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Not authenticated");
  }
  return identity;
}

export async function getCurrentUserIdOrThrow(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await getUserIdentityOrThrow(ctx);
  return identity.tokenIdentifier;
}

export async function requireAuthentication(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }
  return identity.tokenIdentifier;
}