// Test file for enhanced planning agent functionality
// This file demonstrates how to use the planning agent with leading questions

/**
 * Example usage of the enhanced planning agent
 * 
 * The enhanced planning agent is designed to:
 * 1. Capture user tasks and organize them
 * 2. Clarify priorities through leading questions
 * 3. Make intelligent assumptions based on user responses
 * 4. Follow the existing communication style
 * 
 * To use the planning agent, call the task tool with:
 * {
 *   subagentType: "planning",
 *   prompt: "User's request or topic to organize",
 *   description: "Brief description of the task"
 * }
 */

// Example 1: User says they're overwhelmed
const example1 = {
  subagentType: "planning",
  prompt: "I'm feeling overwhelmed with everything I need to do",
  description: "User feeling overwhelmed"
};

// Example 2: User mentions multiple areas
const example2 = {
  subagentType: "planning",
  prompt: "I have work projects, home improvements, and personal goals I want to work on",
  description: "Multiple life areas"
};

// Example 3: User mentions specific stress
const example3 = {
  subagentType: "planning",
  prompt: "I keep thinking about this presentation I have to give tomorrow and I can't focus on anything else",
  description: "Work presentation stress"
};

// Example 4: User mentions deadlines
const example4 = {
  subagentType: "planning",
  prompt: "I have taxes due next week, a project deadline in two weeks, and some home maintenance I've been putting off",
  description: "Multiple deadlines"
};

export { example1, example2, example3, example4 };