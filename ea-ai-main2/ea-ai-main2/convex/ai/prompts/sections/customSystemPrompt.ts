export function getCustomSystemPromptSection(customPrompt: string = ""): string {
  if (!customPrompt) {
    return "";
  }
  
  return `
<custom_system_prompt>
${customPrompt}
</custom_system_prompt>
`;
}