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
    <div className="flex items-center justify-between padding-primary border border-border rounded-design-md bg-card/30 hover:bg-card/50 transition-colors">
      <div className="flex items-center gap-primary">
        <div className={`w-8 h-8 ${backgroundStyle} rounded-design-sm flex items-center justify-center p-1`}>
          <span className="text-white text-sm font-semibold">{iconText}</span>
        </div>
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium text-secondary">{appName}</div>
            {isConnected && (
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            )}
          </div>
          <div className="text-tertiary">{description}</div>
        </div>
      </div>
      <Button 
        variant={getButtonVariant()}
        size="sm" 
        className="bg-background hover:bg-muted shrink-0"
        onClick={onConnect}
        disabled={!canConnect || isConnecting}
      >
        {getButtonText()}
      </Button>
    </div>
  );
}