import { v } from "convex/values";
import { query, mutation, MutationCtx } from "./_generated/server";

/**
 * Get the active mental model for a user
 */
export const getUserMentalModel = query({
  args: {
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, { tokenIdentifier }) => {
    // Get the active mental model for this user
    const mentalModel = await ctx.db
      .query("mentalModels")
      .withIndex("by_tokenIdentifier_and_active", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier).eq("isActive", true)
      )
      .first();

    if (!mentalModel) {
      return {
        content: "",
        exists: false,
        message: "No mental model found - needs to be created",
      };
    }

    return {
      content: mentalModel.content,
      exists: true,
      version: mentalModel.version,
      lastUpdated: mentalModel.updatedAt,
      message: "Mental model loaded successfully",
    };
  },
});

/**
 * Shared helper function for mental model database operations
 * Used by both upsertMentalModel and editMentalModel to avoid mutation→mutation calls
 */
async function upsertMentalModelHelper(
  ctx: MutationCtx,
  { tokenIdentifier, content }: { tokenIdentifier: string; content: string }
) {
  const now = Date.now();

  // Check if user has an existing active mental model
  const existingModel = await ctx.db
    .query("mentalModels")
    .withIndex("by_tokenIdentifier_and_active", (q) =>
      q.eq("tokenIdentifier", tokenIdentifier).eq("isActive", true)
    )
    .first();

  if (existingModel) {
    // Update existing model
    await ctx.db.patch(existingModel._id, {
      content,
      version: existingModel.version + 1,
      updatedAt: now,
    });

    return {
      success: true,
      operation: "updated",
      version: existingModel.version + 1,
      message: "Mental model updated successfully",
    };
  } else {
    // Create new model
    const newModelId = await ctx.db.insert("mentalModels", {
      tokenIdentifier,
      content,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    });

    return {
      success: true,
      operation: "created",
      version: 1,
      modelId: newModelId,
      message: "Mental model created successfully",
    };
  }
}

/**
 * Create or update a user's mental model
 */
export const upsertMentalModel = mutation({
  args: {
    tokenIdentifier: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { tokenIdentifier, content }) => {
    return await upsertMentalModelHelper(ctx, { tokenIdentifier, content });
  },
});

/**
 * Update mental model content using edit operations (similar to file editing)
 */
export const editMentalModel = mutation({
  args: {
    tokenIdentifier: v.string(),
    oldString: v.string(),
    newString: v.string(),
    replaceAll: v.optional(v.boolean()),
  },
  handler: async (ctx, { tokenIdentifier, oldString, newString, replaceAll = false }) => {
    // Get current mental model
    const currentModel = await ctx.db
      .query("mentalModels")
      .withIndex("by_tokenIdentifier_and_active", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier).eq("isActive", true)
      )
      .first();

    let content = "";
    let isNewModel = false;

    if (currentModel) {
      content = currentModel.content;
    } else if (oldString !== "") {
      throw new Error("Mental model not found and oldString is not empty. Use empty oldString to create new model.");
    } else {
      isNewModel = true;
    }

    // Perform the edit operation
    let updatedContent: string;
    if (oldString === "") {
      // Creating new model or appending
      updatedContent = isNewModel ? newString : content + "\n" + newString;
    } else if (replaceAll) {
      updatedContent = content.replaceAll(oldString, newString);
    } else {
      if (!content.includes(oldString)) {
        throw new Error(`Old string not found in mental model: "${oldString.slice(0, 50)}..."`);
      }
      updatedContent = content.replace(oldString, newString);
    }

    // Save the updated content using helper function (avoids mutation→mutation call)
    const result = await upsertMentalModelHelper(ctx, { tokenIdentifier, content: updatedContent });

    return {
      success: true,
      operation: isNewModel ? "created" : (oldString === "" ? "appended" : (replaceAll ? "replaced_all" : "replaced_once")),
      oldLength: content.length,
      newLength: updatedContent.length,
      sizeDifference: updatedContent.length - content.length,
      message: result.message,
      version: result.version,
    };
  },
});

/**
 * Get mental model history for a user
 */
export const getMentalModelHistory = query({
  args: {
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, { tokenIdentifier }) => {
    const models = await ctx.db
      .query("mentalModels")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .order("desc")
      .take(10); // Get last 10 versions

    return models.map((model) => ({
      version: model.version,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      isActive: model.isActive,
      contentLength: model.content.length,
      preview: model.content.slice(0, 100) + (model.content.length > 100 ? "..." : ""),
    }));
  },
});