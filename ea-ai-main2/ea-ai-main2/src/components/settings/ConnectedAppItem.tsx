"use client";

// Claude-themed connected app item component

import { Button } from "../ui/button";

interface ConnectedAppItemProps {
  appName: string;
  description: string;
  iconBgColor: string;
  iconText: string;
  gradientFrom?: string;
  gradientTo?: string;
  isConnected?: boolean;
  isConnecting?: boolean;
  canConnect?: boolean;
  onConnect: () => void;
}

export function ConnectedAppItem({
  appName,
  description,
  iconBgColor,
  iconText,
  gradientFrom,
  gradientTo,
  isConnected = false,
  isConnecting = false,
  canConnect = true,
  onConnect
}: ConnectedAppItemProps) {
  // Use gradient if both from and to are provided, otherwise solid color
  const backgroundStyle = gradientFrom && gradientTo
    ? `bg-gradient-to-br from-${gradientFrom} to-${gradientTo}`
    : iconBgColor;

  const getButtonText = () => {
    if (isConnecting) return "Connecting...";
    if (isConnected) return "Disconnect";
    return "Connect";
  };

  const getButtonVariant = () => {
    if (isConnected) return "destructive" as const;
    return "outline" as const;
  };

  return (
    <div 
      className="flex items-center justify-between p-4 border rounded-md transition-colors"
      style={{
        backgroundColor: "var(--medium-dark)",
        borderColor: "var(--color-border)"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--medium-dark)";
      }}
    >
      <div className="flex items-center gap-4">
        <div className={`w-8 h-8 ${backgroundStyle} rounded-sm flex items-center justify-center p-1`}>
          <span className="text-white text-sm font-semibold">{iconText}</span>
        </div>
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div 
              className="font-medium"
              style={{ color: "var(--soft-off-white)" }}
            >
              {appName}
            </div>
            {isConnected && (
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            )}
          </div>
          <div style={{ color: "var(--neutral-stone)" }}>{description}</div>
        </div>
      </div>
      <Button 
        variant={getButtonVariant()}
        size="sm" 
        className="shrink-0 transition-colors"
        style={{
          backgroundColor: isConnected ? "transparent" : "var(--primary-blue)",
          borderColor: isConnected ? "#ef4444" : "var(--primary-blue)",
          color: isConnected ? "#ef4444" : "var(--pure-white)"
        }}
        onMouseEnter={(e) => {
          if (isConnected) {
            e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
          } else {
            e.currentTarget.style.backgroundColor = "rgba(91, 159, 196, 0.9)";
          }
        }}
        onMouseLeave={(e) => {
          if (isConnected) {
            e.currentTarget.style.backgroundColor = "transparent";
          } else {
            e.currentTarget.style.backgroundColor = "var(--primary-blue)";
          }
        }}
        onClick={onConnect}
        disabled={!canConnect || isConnecting}
      >
        {getButtonText()}
      </Button>
    </div>
  );
}