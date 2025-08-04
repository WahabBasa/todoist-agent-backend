interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolCalls?: Array<{
    name: string;
    args: any;
    result: any;
  }>;
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const time = new Date(message.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
        isUser 
          ? "bg-blue-600 text-white" 
          : "bg-gray-100 text-gray-800"
      }`}>
        <p className="text-sm">{message.content}</p>
        
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
            {message.toolCalls.map((toolCall, index) => (
              <div key={index} className="text-xs opacity-75">
                <span className="font-medium">Action:</span> {getToolCallDescription(toolCall)}
              </div>
            ))}
          </div>
        )}
        
        <p className={`text-xs mt-1 ${
          isUser ? "text-blue-100" : "text-gray-500"
        }`}>
          {time}
        </p>
      </div>
    </div>
  );
}

function getToolCallDescription(toolCall: any): string {
  switch (toolCall.name) {
    case "createTask":
      return `Created task: "${toolCall.args.title}"`;
    case "updateTask":
      return `Updated task`;
    case "deleteTask":
      return `Deleted task`;
    case "createProject":
      return `Created project: "${toolCall.args.name}"`;
    case "getTasks":
      return `Retrieved ${Array.isArray(toolCall.result) ? toolCall.result.length : 0} tasks`;
    default:
      return toolCall.name;
  }
}
