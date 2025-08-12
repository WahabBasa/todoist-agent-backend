export function AuthHeader() {
  return (
    <div className="text-center space-y-2">
      <div className="flex items-center justify-center space-x-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-lg">T</span>
        </div>
        <h1 className="text-2xl font-bold">TaskAI</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        AI-powered task management for modern workflows
      </p>
    </div>
  );
}