"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { generateText } from "ai";

// Helper: sanitize and normalize model output to a safe short title
function sanitizeTitle(raw: string, fallbackSource: string): string {
  const fallback = deriveFallbackTitle(fallbackSource);
  if (!raw || !raw.trim()) return fallback;

  let t = raw.replace(/[\r\n]+/g, " ").trim();
  t = t.replace(/^\s*(chat\s*title\s*:\s*)/i, "");
  t = t.replace(/^i\s+am\s+[^].*$/i, (m) => m.replace(/^i\s+am\s+/i, ""));
  t = t.replace(/^i\'?m\s+[^].*$/i, (m) => m.replace(/^i\'?m\s+/i, ""));
  t = t.replace(/\b(grok|xai|openai|anthropic|llama|mistral)\b/gi, "");
  t = t.replace(/^["'\-:;\s]+|["'\-:;\s]+$/g, "").trim();
  const words = t.split(/\s+/).filter(Boolean).slice(0, 6);
  t = words.join(" ");
  if (!t) return fallback;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function deriveFallbackTitle(src: string): string {
  const s = (src || "").replace(/[\r\n]+/g, " ").trim();
  if (!s) return "New Chat";
  const first = s.split(/[.!?]/)[0] || s;
  const cleaned = first.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 6);
  const t = words.join(" ");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "New Chat";
}

function sanitizeGreeting(raw: string, lastName: string, localHour?: number): string {
  const fallback = fallbackGreeting(lastName, localHour);
  if (!raw || !raw.trim()) return fallback;
  let t = raw.replace(/[\r\n]+/g, " ").trim();
  t = t.replace(/\b(grok|xai|openai|anthropic|llama|mistral)\b/gi, "");
  t = t.replace(/[\p{Emoji}\p{Extended_Pictographic}]/gu, "").replace(/^["'\-:;\s]+|["'\-:;\s]+$/g, "").trim();
  const words = t.split(/\s+/).filter(Boolean).slice(0, 10);
  t = words.join(" ");
  if (!/[.!?]$/.test(t)) t = t + ".";
  return t || fallback;
}

function fallbackGreeting(lastName: string, localHour?: number): string {
  const cleanLast = (lastName || "there").replace(/[^\p{L}\p{N} -]/gu, "").trim() || "there";
  const h = typeof localHour === 'number' ? localHour : new Date().getHours();
  const tod = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `${tod}, ${cleanLast}.`;
}

// Node runtime implementation for generating a concise chat title
export const generateChatTitleWithAI_impl = action({
  args: { sessionId: v.id("chatSessions"), prompt: v.string() },
  handler: async (ctx, { sessionId, prompt }): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const tokenIdentifier = identity.tokenIdentifier || identity.subject;

    const [userCfg, globalCfg, session, conversation]: [any, any, any, any] = await Promise.all([
      ctx.runQuery(api.providers.unified.getUserProviderConfig, { tokenIdentifier }),
      ctx.runQuery(api.providers.unified.getGlobalProviderConfig, {}),
      ctx.runQuery(api.chatSessions.getChatSession, { sessionId }),
      ctx.runQuery(api.conversations.getConversationBySession, { sessionId })
    ]);

    const provider = (userCfg?.apiProvider || globalCfg?.apiProvider || "openrouter") as string;
    if (provider !== "openrouter") return;

    const apiKey = userCfg?.openRouterApiKey || globalCfg?.openRouterApiKey || (process.env.OPENROUTER_API_KEY as string | undefined);
    if (!apiKey) return;
    const baseURL = userCfg?.openRouterBaseUrl || globalCfg?.openRouterBaseUrl || "https://openrouter.ai/api/v1";
    const modelId: string = userCfg?.activeModelId || globalCfg?.activeModelId || "openai/gpt-4.1-nano";

    const mode = (session?.activeMode || session?.primaryMode || "primary") as string;
    const msgArr: any[] = Array.isArray((conversation as any)?.messages) ? ((conversation as any).messages as any[]) : [];
    const userMsgs = msgArr.filter(m => m?.role === "user");
    if (!Array.isArray(userMsgs) || userMsgs.length < 2) return;
    const firstUserMsg = userMsgs[0]?.content ?? "";
    const secondUserMsg = userMsgs[1]?.content ?? "";
    const lastAssistant = [...msgArr].reverse().find(m => m?.role === "assistant");

    const trimText = (s: unknown, max = 250) => {
      const t = typeof s === "string" ? s : "";
      return t.replace(/[\r\n]+/g, " ").trim().slice(0, max);
    };

    const u0 = trimText(firstUserMsg, 250);
    const u1 = trimText(secondUserMsg, 250);
    const a0 = trimText(lastAssistant?.content ?? "", 200);

    const primaryHint = "You act as a neutral task assistant; keep titles short and descriptive.";
    const planningHint = "Planning conversations organize tasks and priorities concisely.";
    const modeHint = mode === "planning" ? planningHint : primaryHint;

    const genericUser = (u1 || "").toLowerCase();
    const isGeneric = genericUser.length < 3 || ["hi", "hello", "help", "hey"].some(w => genericUser === w);

    try {
      const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
      const openrouter = createOpenRouter({ apiKey, baseURL });
      const system = [
        "You are a title generator.",
        "Return ONLY a concise 2–6 word neutral title summarizing this conversation.",
        "No prefixes or labels (e.g., 'Chat Title:'), no emojis, no first-person statements, and no vendor/model names.",
        "Output just the title."
      ].join(" ");

      const userContent = [
        `Mode: ${mode}`,
        `PrimaryPromptHint: ${modeHint}`,
        u0 ? `FirstUser: ${u0}` : undefined,
        u1 ? `SecondUser: ${u1}` : undefined,
        a0 ? `Assistant: ${a0}` : undefined,
        "Return only the title."
      ].filter(Boolean).join("\n");

      const res: any = isGeneric
        ? { text: "" }
        : await generateText({
            model: openrouter.chat(modelId),
            system,
            messages: [{ role: "user", content: userContent }],
            temperature: 0.2 as any,
            maxTokens: 16 as any,
          } as any);

      const raw: string = (res?.text || "").trim();
      const cleaned = sanitizeTitle(raw, u1 || prompt || "New Chat");
      if (cleaned && cleaned.toLowerCase() !== "new chat") {
        const fallback0 = deriveFallbackTitle(u0);
        const fallback1 = deriveFallbackTitle(u1);
        await ctx.scheduler.runAfter(0, internal.chatSessions.applyTitleInternal, { sessionId, title: cleaned, allowIfEquals: [fallback0, fallback1] });
      }
    } catch {
      // best-effort only
    }
  }
});

// Node runtime implementation for greeting generation
export const generateGreetingForUser_impl = action({
  args: { sessionId: v.id("chatSessions"), lastName: v.string(), localHour: v.optional(v.number()) },
  handler: async (ctx, { sessionId, lastName, localHour }): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return fallbackGreeting(lastName, localHour);
    const tokenIdentifier = identity.tokenIdentifier || identity.subject;

    const [userCfg, globalCfg]: [any, any] = await Promise.all([
      ctx.runQuery(api.providers.unified.getUserProviderConfig, { tokenIdentifier }),
      ctx.runQuery(api.providers.unified.getGlobalProviderConfig, {})
    ]);

    const provider = (userCfg?.apiProvider || globalCfg?.apiProvider || "openrouter") as string;
    if (provider !== "openrouter") return fallbackGreeting(lastName, localHour);

    const apiKey = userCfg?.openRouterApiKey || globalCfg?.openRouterApiKey || (process.env.OPENROUTER_API_KEY as string | undefined);
    if (!apiKey) return fallbackGreeting(lastName, localHour);
    const baseURL = userCfg?.openRouterBaseUrl || globalCfg?.openRouterBaseUrl || "https://openrouter.ai/api/v1";
    const modelId: string = userCfg?.activeModelId || globalCfg?.activeModelId || "openai/gpt-4.1-nano";

    try {
      const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
      const openrouter = createOpenRouter({ apiKey, baseURL });
      const tod = typeof localHour === 'number' ? (localHour < 12 ? 'morning' : localHour < 18 ? 'afternoon' : 'evening') : '';
      const system = [
        "You are a greeting generator.",
        "Return ONLY a short, warm, neutral greeting (max 10 words).",
        "Use ONLY the provided last name to address the user.",
        "No emojis. No questions. No vendor/model names. Output just the greeting."
      ].join(" ");
      const userContent = [
        lastName ? `LastName: ${lastName}` : undefined,
        tod ? `TimeOfDay: ${tod}` : undefined,
        "Return only the greeting."
      ].filter(Boolean).join("\n");

      const res: any = await generateText({
        model: openrouter.chat(modelId),
        system,
        messages: [{ role: "user", content: userContent }],
        temperature: 0.2 as any,
        maxTokens: 24 as any
      } as any);

      const raw: string = (res?.text || "").trim();
      return sanitizeGreeting(raw, lastName, localHour);
    } catch {
      return fallbackGreeting(lastName, localHour);
    }
  }
});
