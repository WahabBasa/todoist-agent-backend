import { v } from "convex/values";
import { query, mutation, MutationCtx } from "./_generated/server";

/**
 * Get all custom system prompts for a user
 */
export const getUserCustomPrompts = query({
  args: {
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, { tokenIdentifier }) => {
    const prompts = await ctx.db
      .query("customSystemPrompts")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .order("desc") // Most recent first
      .collect();

    return prompts.map((prompt) => ({
      id: prompt._id,
      name: prompt.name,
      content: prompt.content,
      version: prompt.version,
      isActive: prompt.isActive,
      isDefault: prompt.isDefault,
      createdAt: prompt.createdAt,
      updatedAt: prompt.updatedAt,
      contentLength: prompt.content.length,
      preview: prompt.content.slice(0, 100) + (prompt.content.length > 100 ? "..." : ""),
    }));
  },
});

/**
 * Get the active custom system prompt for a user
 */
export const getActiveCustomPrompt = query({
  args: {
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, { tokenIdentifier }) => {
    // Get the active custom prompt for this user
    const customPrompt = await ctx.db
      .query("customSystemPrompts")
      .withIndex("by_tokenIdentifier_and_active", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier).eq("isActive", true)
      )
      .first();

    if (!customPrompt) {
      return {
        content: "",
        exists: false,
        message: "No active custom system prompt found",
      };
    }

    return {
      id: customPrompt._id,
      name: customPrompt.name,
      content: customPrompt.content,
      exists: true,
      version: customPrompt.version,
      isDefault: customPrompt.isDefault,
      lastUpdated: customPrompt.updatedAt,
      message: "Active custom system prompt loaded successfully",
    };
  },
});

/**
 * Get the default custom system prompt for a user
 */
export const getDefaultCustomPrompt = query({
  args: {
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, { tokenIdentifier }) => {
    const defaultPrompt = await ctx.db
      .query("customSystemPrompts")
      .withIndex("by_tokenIdentifier_and_default", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier).eq("isDefault", true)
      )
      .first();

    if (!defaultPrompt) {
      return {
        content: "",
        exists: false,
        message: "No default custom system prompt found",
      };
    }

    return {
      id: defaultPrompt._id,
      name: defaultPrompt.name,
      content: defaultPrompt.content,
      exists: true,
      version: defaultPrompt.version,
      isActive: defaultPrompt.isActive,
      lastUpdated: defaultPrompt.updatedAt,
      message: "Default custom system prompt loaded successfully",
    };
  },
});

/**
 * Shared helper function for custom system prompt database operations
 * Used by both upsertCustomPrompt and editCustomPrompt to avoid mutation→mutation calls
 */
async function upsertCustomPromptHelper(
  ctx: MutationCtx,
  { tokenIdentifier, name, content, isDefault = false }: { 
    tokenIdentifier: string; 
    name: string;
    content: string;
    isDefault?: boolean;
  }
) {
  const now = Date.now();

  // Check if user has an existing prompt with this name
  const existingPrompt = await ctx.db
    .query("customSystemPrompts")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .filter((q) => q.eq(q.field("name"), name))
    .first();

  if (existingPrompt) {
    // Update existing prompt
    await ctx.db.patch(existingPrompt._id, {
      content,
      version: existingPrompt.version + 1,
      isDefault,
      updatedAt: now,
    });

    return {
      success: true,
      operation: "updated",
      promptId: existingPrompt._id,
      version: existingPrompt.version + 1,
      message: `Custom system prompt "${name}" updated successfully`,
    };
  } else {
    // If this is the first prompt or marked as default, make it active and default
    const isFirstPrompt = !(await ctx.db
      .query("customSystemPrompts")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .first());

    // Create new prompt
    const newPromptId = await ctx.db.insert("customSystemPrompts", {
      tokenIdentifier,
      name,
      content,
      version: 1,
      isActive: isFirstPrompt || isDefault, // First prompt is always active
      isDefault: isFirstPrompt || isDefault, // First prompt is always default
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      operation: "created",
      promptId: newPromptId,
      version: 1,
      message: `Custom system prompt "${name}" created successfully`,
    };
  }
}

/**
 * Create or update a custom system prompt
 */
export const upsertCustomPrompt = mutation({
  args: {
    tokenIdentifier: v.string(),
    name: v.string(),
    content: v.string(),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, { tokenIdentifier, name, content, isDefault = false }) => {
    return await upsertCustomPromptHelper(ctx, { tokenIdentifier, name, content, isDefault });
  },
});

/**
 * Edit custom system prompt content using edit operations (similar to file editing)
 */
export const editCustomPrompt = mutation({
  args: {
    tokenIdentifier: v.string(),
    promptName: v.string(),
    oldString: v.string(),
    newString: v.string(),
    replaceAll: v.optional(v.boolean()),
  },
  handler: async (ctx, { tokenIdentifier, promptName, oldString, newString, replaceAll = false }) => {
    // Get current custom prompt by name
    const currentPrompt = await ctx.db
      .query("customSystemPrompts")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .filter((q) => q.eq(q.field("name"), promptName))
      .first();

    let content = "";
    let isNewPrompt = false;

    if (currentPrompt) {
      content = currentPrompt.content;
    } else if (oldString !== "") {
      throw new Error(`Custom system prompt "${promptName}" not found and oldString is not empty. Use empty oldString to create new prompt.`);
    } else {
      isNewPrompt = true;
    }

    // Perform the edit operation
    let updatedContent: string;
    if (oldString === "") {
      // Creating new prompt or appending
      updatedContent = isNewPrompt ? newString : content + "\n" + newString;
    } else if (replaceAll) {
      updatedContent = content.replace(new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newString);
    } else {
      if (!content.includes(oldString)) {
        throw new Error(`Old string not found in custom system prompt "${promptName}": "${oldString.slice(0, 50)}..."`);
      }
      updatedContent = content.replace(oldString, newString);
    }

    // Save the updated content using helper function (avoids mutation→mutation call)
    const result = await upsertCustomPromptHelper(ctx, { 
      tokenIdentifier, 
      name: promptName, 
      content: updatedContent,
      isDefault: currentPrompt?.isDefault || false 
    });

    return {
      success: true,
      operation: isNewPrompt ? "created" : (oldString === "" ? "appended" : (replaceAll ? "replaced_all" : "replaced_once")),
      oldLength: content.length,
      newLength: updatedContent.length,
      sizeDifference: updatedContent.length - content.length,
      message: result.message,
      version: result.version,
    };
  },
});

/**
 * Set which custom system prompt is active
 */
export const setActiveCustomPrompt = mutation({
  args: {
    tokenIdentifier: v.string(),
    promptName: v.string(),
  },
  handler: async (ctx, { tokenIdentifier, promptName }) => {
    // First, deactivate all current active prompts for this user
    const currentActivePrompts = await ctx.db
      .query("customSystemPrompts")
      .withIndex("by_tokenIdentifier_and_active", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier).eq("isActive", true)
      )
      .collect();

    for (const activePrompt of currentActivePrompts) {
      await ctx.db.patch(activePrompt._id, { isActive: false });
    }

    // Find the prompt to activate
    const promptToActivate = await ctx.db
      .query("customSystemPrompts")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .filter((q) => q.eq(q.field("name"), promptName))
      .first();

    if (!promptToActivate) {
      throw new Error(`Custom system prompt "${promptName}" not found`);
    }

    // Activate the selected prompt
    await ctx.db.patch(promptToActivate._id, { 
      isActive: true,
      updatedAt: Date.now()
    });

    return {
      success: true,
      message: `Custom system prompt "${promptName}" is now active`,
      promptId: promptToActivate._id,
    };
  },
});

/**
 * Set which custom system prompt is the default
 */
export const setDefaultCustomPrompt = mutation({
  args: {
    tokenIdentifier: v.string(),
    promptName: v.string(),
  },
  handler: async (ctx, { tokenIdentifier, promptName }) => {
    // First, remove default flag from all current default prompts for this user
    const currentDefaultPrompts = await ctx.db
      .query("customSystemPrompts")
      .withIndex("by_tokenIdentifier_and_default", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier).eq("isDefault", true)
      )
      .collect();

    for (const defaultPrompt of currentDefaultPrompts) {
      await ctx.db.patch(defaultPrompt._id, { isDefault: false });
    }

    // Find the prompt to set as default
    const promptToSetDefault = await ctx.db
      .query("customSystemPrompts")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .filter((q) => q.eq(q.field("name"), promptName))
      .first();

    if (!promptToSetDefault) {
      throw new Error(`Custom system prompt "${promptName}" not found`);
    }

    // Set the selected prompt as default
    await ctx.db.patch(promptToSetDefault._id, { 
      isDefault: true,
      updatedAt: Date.now()
    });

    return {
      success: true,
      message: `Custom system prompt "${promptName}" is now the default`,
      promptId: promptToSetDefault._id,
    };
  },
});

/**
 * Delete a custom system prompt
 */
export const deleteCustomPrompt = mutation({
  args: {
    tokenIdentifier: v.string(),
    promptName: v.string(),
  },
  handler: async (ctx, { tokenIdentifier, promptName }) => {
    const promptToDelete = await ctx.db
      .query("customSystemPrompts")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .filter((q) => q.eq(q.field("name"), promptName))
      .first();

    if (!promptToDelete) {
      throw new Error(`Custom system prompt "${promptName}" not found`);
    }

    await ctx.db.delete(promptToDelete._id);

    return {
      success: true,
      message: `Custom system prompt "${promptName}" deleted successfully`,
    };
  },
});

/**
 * Get custom system prompt history for a user
 */
export const getCustomPromptHistory = query({
  args: {
    tokenIdentifier: v.string(),
    promptName: v.optional(v.string()),
  },
  handler: async (ctx, { tokenIdentifier, promptName }) => {
    let queryBuilder = ctx.db
      .query("customSystemPrompts")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier));

    if (promptName) {
      queryBuilder = queryBuilder.filter((q) => q.eq(q.field("name"), promptName));
    }

    const prompts = await queryBuilder
      .order("desc")
      .take(20); // Get last 20 versions

    return prompts.map((prompt) => ({
      name: prompt.name,
      version: prompt.version,
      createdAt: prompt.createdAt,
      updatedAt: prompt.updatedAt,
      isActive: prompt.isActive,
      isDefault: prompt.isDefault,
      contentLength: prompt.content.length,
      preview: prompt.content.slice(0, 100) + (prompt.content.length > 100 ? "..." : ""),
    }));
  },
});