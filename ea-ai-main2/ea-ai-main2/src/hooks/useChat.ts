// This file is separated to fix HMR/Fast Refresh compatibility issues
// Previously, chat.tsx exported both components and hooks, which violates Vite's Fast Refresh rules

export { useConvexChat, type Message, type UseConvexChatOptions, type UseConvexChatReturn } from './useConvexChat';