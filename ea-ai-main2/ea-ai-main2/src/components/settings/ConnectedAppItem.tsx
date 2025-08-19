import { Button } from "../ui/button";

interface ConnectedAppItemProps {
  appName: string;
  description: string;
  iconBgColor: string;
  iconText: string;
  gradientFrom?: string;
  gradientTo?: string;
  onConnect: () => void;
}

export function ConnectedAppItem({
  appName,
  description,
  iconBgColor,
  iconText,
  gradientFrom,
  gradientTo,
  onConnect
}: ConnectedAppItemProps) {
  // Use gradient if both from and to are provided, otherwise solid color
  const backgroundStyle = gradientFrom && gradientTo
    ? `bg-gradient-to-br from-${gradientFrom} to-${gradientTo}`
    : iconBgColor;

  return (
    <div className="flex items-center justify-between padding-primary border border-border rounded-design-md bg-card/30 hover:bg-card/50 transition-colors">
      <div className="flex items-center gap-primary">
        <div className={`w-8 h-8 ${backgroundStyle} rounded-design-sm flex items-center justify-center p-1`}>
          <span className="text-white text-sm font-semibold">{iconText}</span>
        </div>
        <div className="space-y-1">
          <div className="font-medium text-secondary">{appName}</div>
          <div className="text-tertiary">{description}</div>
        </div>
      </div>
      <Button 
        variant="outline" 
        size="sm" 
        className="bg-background hover:bg-muted shrink-0"
        onClick={onConnect}
      >
        Connect
      </Button>
    </div>
  );
}