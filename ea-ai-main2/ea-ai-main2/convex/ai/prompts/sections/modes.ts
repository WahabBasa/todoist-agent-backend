import { PrimaryModeRegistry, PrimaryModeConfig } from "../../modes/registry";

export function getModesSection(): string {
  // Get all available modes from the registry
  const allModes = PrimaryModeRegistry.getAllPrimaryModes();
  
  let modesContent = `====

PRODUCTIVITY FOCUS MODES

**Autonomous Mode Switching System**
- The AI can autonomously switch between specialized modes based on task requirements
- Mode switches are executed automatically without user approval to reduce operational overhead
- Each mode has specific tool permissions and capabilities for focused execution
- Mode switching helps reduce user overwhelm by selecting the most appropriate execution context

**Available Modes:**
`;

  // Generate mode descriptions dynamically from the registry
  for (const [modeName, modeConfig] of Object.entries(allModes)) {
    const typedModeConfig = modeConfig as PrimaryModeConfig;
    let description: string;
    if (typedModeConfig.description && typedModeConfig.description.trim() !== "") {
      // Use the description as the primary description
      description = typedModeConfig.description.replace(/\n/g, "\n    ");
    } else {
      // Fallback to the name if no description
      description = typedModeConfig.name;
    }
    
    modesContent += `  * "${typedModeConfig.name}" mode (${modeName}) - ${description}\n`;
  }

  modesContent += `
**Mode Switching Instructions**
- Use the switchMode tool to autonomously switch between available modes
- Example: When overwhelmed with planning complexity, switch to 'planning' mode for structured analysis
- Example: When needing information clarification, switch to 'information-collector' mode
- Example: When orchestrating complex workflows, use 'primary' mode for coordination
- Goal-driven switching prioritizes reducing user overwhelm and operational overhead

**Mode Capabilities Summary**
- Primary mode: Orchestration and delegation to specialized modes
- Information-collector mode: Systematic information gathering and questioning
- Planning mode: Strategic planning and task organization with prioritization
- Each mode has appropriate tool access tailored to its specific function

**Delegation and Permissions**
- Primary mode: Can delegate to any subagent
- Planning mode: Can delegate to execution subagent only  
- Other modes: Direct execution with restricted delegation`;

  return modesContent;
}