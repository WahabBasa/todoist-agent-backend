import { Button } from "../ui/button";
import { useChat } from "../../context/chat";
import { cn } from "@/lib/utils";

export function QuickPromptButtons() {
  const { setInput } = useChat();

  return (
    <div className={cn("w-full md:w-[740px] lg:w-[760px] mx-auto flex items-center justify-center gap-2 flex-nowrap")}>        
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-8 px-2.5 rounded-md border border-border",
          "bg-muted hover:bg-muted/80",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          "focus-visible:outline-[var(--primary-blue)] transition-all"
        )}
        onClick={() => setInput("Help me break this task down.")}
      >
        Task Breakdown
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-8 px-2.5 rounded-md border border-border",
          "bg-muted hover:bg-muted/80",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          "focus-visible:outline-[var(--primary-blue)] transition-all"
        )}
        onClick={() => setInput("I have a bunch of things on my head and I don't know where to start")}
      >
        Planning
      </Button>
    </div>
  );
}
