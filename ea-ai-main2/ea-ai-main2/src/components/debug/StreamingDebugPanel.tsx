import { useState, useEffect } from 'react';
import { FEATURE_FLAGS, FeatureFlagUtils, FEATURE_PRESETS, applyFeaturePreset } from '@/config/featureFlags';

// =================================================================
// STREAMING DEBUG PANEL
// Development tool for monitoring and controlling streaming system
// Only visible in development mode
// =================================================================

interface StreamingDebugPanelProps {
  streamingMessage?: any;
  debugInfo?: any;
  isVisible?: boolean;
}

export function StreamingDebugPanel({ 
  streamingMessage, 
  debugInfo, 
  isVisible = false 
}: StreamingDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  // Don't render in production
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  // Don't render if not visible
  if (!isVisible && !FEATURE_FLAGS.enableStreamingDebug) {
    return null;
  }

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    if (preset && preset in FEATURE_PRESETS) {
      applyFeaturePreset(preset as keyof typeof FEATURE_PRESETS);
      // Trigger a page reload to apply changes
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const streamingConfig = FeatureFlagUtils.getStreamingConfig();

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Minimized toggle button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600 transition-colors"
          title="Open Streaming Debug Panel"
        >
          🔍
        </button>
      )}

      {/* Expanded debug panel */}
      {isExpanded && (
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              🚀 Streaming Debug
            </h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          {/* System Status */}
          <div className="mb-4">
            <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">System Status</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Mode:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  FEATURE_FLAGS.useEventStreaming 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                }`}>
                  {FEATURE_FLAGS.useEventStreaming ? 'EVENT-DRIVEN' : 'LEGACY'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Hybrid:</span>
                <span className={FEATURE_FLAGS.useHybridMode ? 'text-green-600' : 'text-red-600'}>
                  {FEATURE_FLAGS.useHybridMode ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Poll Interval:</span>
                <span>{streamingConfig.pollInterval}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Debug:</span>
                <span className={streamingConfig.enableDebug ? 'text-green-600' : 'text-red-600'}>
                  {streamingConfig.enableDebug ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>

          {/* Current Stream Info */}
          {streamingMessage && (
            <div className="mb-4">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Current Stream</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>ID:</span>
                  <span className="font-mono text-xs">{streamingMessage.id?.slice(-8)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    streamingMessage.status === 'complete' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      : streamingMessage.status === 'error'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'  
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                  }`}>
                    {streamingMessage.status?.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Events:</span>
                  <span>{streamingMessage.eventCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Content:</span>
                  <span>{streamingMessage.content?.length || 0} chars</span>
                </div>
                <div className="flex justify-between">
                  <span>Tools:</span>
                  <span>{streamingMessage.toolExecutions?.length || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Debug Info */}
          {debugInfo && (
            <div className="mb-4">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Performance</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Total Events:</span>
                  <span>{debugInfo.totalEvents}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Event:</span>
                  <span>{debugInfo.lastEventTime ? new Date(debugInfo.lastEventTime).toLocaleTimeString() : 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Reconstruction:</span>
                  <span>{debugInfo.reconstructionTime}ms</span>
                </div>
              </div>
            </div>
          )}

          {/* Feature Presets */}
          <div className="mb-4">
            <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Presets</h4>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            >
              <option value="">Select a preset...</option>
              <option value="FULL_EVENT_DRIVEN">🚀 Full Event-Driven</option>
              <option value="HYBRID_SAFE">🛡️ Hybrid Safe</option>
              <option value="LEGACY_ONLY">🐢 Legacy Only</option>
              <option value="PERFORMANCE">⚡ Performance</option>
              <option value="DEBUG">🐛 Debug Mode</option>
            </select>
            {selectedPreset && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Applied {selectedPreset}. Page will reload in 1s...
              </p>
            )}
          </div>

          {/* Tool Executions */}
          {streamingMessage?.toolExecutions?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Tool Executions</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {streamingMessage.toolExecutions.map((tool: any, idx: number) => (
                  <div key={idx} className="text-xs bg-gray-50 dark:bg-gray-700 p-2 rounded">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{tool.toolName}</span>
                      <span className={`px-1 py-0.5 rounded text-xs ${
                        tool.status === 'completed' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                          : tool.status === 'error'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                          : tool.status === 'running'  
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                      }`}>
                        {tool.status}
                      </span>
                    </div>
                    {tool.startTime && tool.endTime && (
                      <div className="text-gray-500 dark:text-gray-400 mt-1">
                        {tool.endTime - tool.startTime}ms
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
            Event-driven streaming system v1.0
          </div>
        </div>
      )}
    </div>
  );
}