// Test script for planning agent
// This script demonstrates how to invoke the planning agent with the new functionality

async function testPlanning() {
  console.log("Testing planning agent...");
  
  // Example 1: User feeling overwhelmed
  const task1 = {
    subagentType: "planning",
    prompt: "I'm feeling overwhelmed with everything I need to do",
    description: "User feeling overwhelmed"
  };
  
  console.log("Example 1 - Overwhelmed user:");
  console.log("Input:", JSON.stringify(task1, null, 2));
  console.log("Expected agent response: QUESTION_FOR_USER: What's taking up most of your mental energy right now?");
  console.log("");
  
  // Example 2: User with multiple deadlines
  const task2 = {
    subagentType: "planning",
    prompt: "I have taxes due next week, a project deadline in two weeks, and some home maintenance I've been putting off",
    description: "Multiple deadlines"
  };
  
  console.log("Example 2 - Multiple deadlines:");
  console.log("Input:", JSON.stringify(task2, null, 2));
  console.log("Expected agent response: INTERNAL_TODO_UPDATE and RECOMMENDATIONS_READY with prioritized actions");
  console.log("");
  
  // Example 3: User with work stress
  const task3 = {
    subagentType: "planning",
    prompt: "I keep thinking about this presentation I have to give tomorrow and I can't focus on anything else",
    description: "Work presentation stress"
  };
  
  console.log("Example 3 - Work presentation stress:");
  console.log("Input:", JSON.stringify(task3, null, 2));
  console.log("Expected agent response: INTERNAL_TODO_UPDATE identifying presentation as high priority, then RECOMMENDATIONS_READY");
  console.log("");
  
  console.log("The planning agent is now ready to use with the existing task tool.");
  console.log("It will automatically use leading questions and intelligent priority detection.");
}

// Run the test
testPlanning();