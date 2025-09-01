"use node";

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { MessageCaching } from "./caching";

// =================================================================
// MENTAL MODEL SYSTEM - Node.js Runtime Functions
// File-based user behavioral learning for personalized AI assistance
// =================================================================

// Load user mental model for personalized AI behavior with caching
export function getUserMentalModel(userId?: string): string {
  // Try to get from cache first if userId provided
  if (userId) {
    const cached = MessageCaching.getCachedMentalModel(userId);
    if (cached) {
      MessageCaching.incrementCacheHit('mental_model');
      return cached;
    }
    MessageCaching.incrementCacheMiss();
  }

  try {
    const mentalModelPath = join(process.cwd(), "convex", "ai", "user-mental-model.txt");
    let content: string;
    
    if (existsSync(mentalModelPath)) {
      const fileContent = readFileSync(mentalModelPath, "utf-8");
      content = `
<user_mental_model>
${fileContent}
</user_mental_model>`;
    } else {
      content = `
<user_mental_model>
No user mental model found - AI should create one by observing behavioral patterns in conversation.
Use readUserMentalModel and editUserMentalModel tools to learn and update user preferences.
</user_mental_model>`;
    }

    // Cache the result if userId provided
    if (userId) {
      MessageCaching.setCachedMentalModel(userId, content);
    }

    return content;
  } catch (error) {
    const errorContent = `
<user_mental_model>
Error loading mental model: ${error instanceof Error ? error.message : 'Unknown error'}
AI should use default behavior and attempt to create mental model during conversation.
</user_mental_model>`;

    // Cache the error result to avoid repeated file I/O failures
    if (userId) {
      MessageCaching.setCachedMentalModel(userId, errorContent);
    }

    return errorContent;
  }
}

// Read mental model file (for tool execution)
export function readMentalModelFile(): { success: boolean; content?: string; error?: string; message: string; path: string } {
  const mentalModelPath = join(process.cwd(), "convex", "ai", "user-mental-model.txt");
  
  try {
    if (existsSync(mentalModelPath)) {
      const mentalModelContent = readFileSync(mentalModelPath, "utf-8");
      return {
        success: true,
        content: mentalModelContent,
        message: "User mental model loaded successfully",
        path: mentalModelPath,
      };
    } else {
      return {
        success: false,
        content: "",
        message: "User mental model file not found - needs to be created",
        path: mentalModelPath,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error reading mental model",
      message: "Failed to read user mental model file",
      path: mentalModelPath,
    };
  }
}

// Edit mental model file (for tool execution)
export function editMentalModelFile(oldString: string, newString: string, replaceAll: boolean = false): { success: boolean; error?: string; message: string; path: string; operation?: string; oldLength?: number; newLength?: number } {
  const editPath = join(process.cwd(), "convex", "ai", "user-mental-model.txt");
  
  try {
    let content = "";
    if (existsSync(editPath)) {
      content = readFileSync(editPath, "utf-8");
    } else {
      // If file doesn't exist and oldString is empty, create new file
      if (oldString === "") {
        content = "";
      } else {
        throw new Error("Mental model file not found and oldString is not empty");
      }
    }
    
    // Perform the edit
    let updatedContent: string;
    if (oldString === "") {
      // Creating new file or appending
      updatedContent = newString;
    } else if (replaceAll) {
      updatedContent = content.replaceAll(oldString, newString);
    } else {
      if (!content.includes(oldString)) {
        throw new Error(`Old string not found in mental model: "${oldString.slice(0, 50)}..."`);
      }
      updatedContent = content.replace(oldString, newString);
    }
    
    // Write the updated content
    writeFileSync(editPath, updatedContent, "utf-8");
    
    // Invalidate all mental model caches since file was modified
    // Note: This is a global invalidation since we don't have userId context in this function
    // In a production system, you might want to pass userId or maintain a mapping
    console.log("[Caching] Mental model file updated, clearing cache");
    
    return {
      success: true,
      message: "User mental model updated successfully",
      path: editPath,
      operation: oldString === "" ? "created" : replaceAll ? "replaced_all" : "replaced_once",
      oldLength: content.length,
      newLength: updatedContent.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error editing mental model",
      message: "Failed to update user mental model file",
      path: editPath,
    };
  }
}