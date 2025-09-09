import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { toast } from "sonner";

export function SessionDebug() {
  const triggerMigration = useMutation(api.debug.sessionMigration.triggerSessionTimestampMigration);
  const debugSessions = useMutation(api.debug.sessionMigration.debugSessionTimestamps);

  const handleMigration = async () => {
    try {
      console.log("🚀 Starting session timestamp migration...");
      const result = await triggerMigration();
      console.log("✅ Migration result:", result);
      toast.success(result.message);
    } catch (error) {
      console.error("❌ Migration failed:", error);
      toast.error("Migration failed: " + error.message);
    }
  };

  const handleDebug = async () => {
    try {
      const result = await debugSessions();
      console.log("📊 Session debug info:", result);
      console.table(result.sessions);
      toast.success(`Found ${result.totalSessions} sessions - check console for details`);
    } catch (error) {
      console.error("❌ Debug failed:", error);
      toast.error("Debug failed: " + error.message);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      <div className="bg-card border rounded-lg p-4 space-y-2 shadow-lg">
        <h3 className="text-sm font-semibold text-foreground">Debug: Missing Chat History</h3>
        <div className="space-y-2">
          <Button 
            onClick={handleDebug}
            variant="outline" 
            size="sm"
            className="w-full text-xs"
          >
            🔍 Debug Sessions
          </Button>
          <Button 
            onClick={handleMigration}
            variant="outline" 
            size="sm"
            className="w-full text-xs"
          >
            🔄 Fix Timestamps
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          This will backfill lastMessageAt for old chats
        </p>
      </div>
    </div>
  );
}