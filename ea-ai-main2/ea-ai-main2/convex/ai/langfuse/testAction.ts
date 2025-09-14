import { action } from "../../_generated/server";
import { v } from "convex/values";
import { testLangfuse } from "./testLangfuse";

/**
 * Action to test Langfuse integration
 */
export const runLangfuseTest = action({
  args: {},
  handler: async (ctx) => {
    try {
      await testLangfuse();
      return { success: true, message: "Langfuse test completed successfully" };
    } catch (error) {
      console.error("[Langfuse Test Action] Test failed:", error);
      return { success: false, message: `Langfuse test failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }
});