import React from 'react';

export function ThemeTest() {
  const [cssVars, setCssVars] = React.useState({
    primary: 'loading...',
    secondary: 'loading...',
    base100: 'loading...',
    base200: 'loading...'
  });

  React.useEffect(() => {
    const root = document.querySelector('[data-theme="ea-theme"]') || document.documentElement;
    const styles = getComputedStyle(root);
    
    setCssVars({
      primary: styles.getPropertyValue('--color-primary').trim() || 'not found',
      secondary: styles.getPropertyValue('--color-secondary').trim() || 'not found', 
      base100: styles.getPropertyValue('--color-base-100').trim() || 'not found',
      base200: styles.getPropertyValue('--color-base-200').trim() || 'not found'
    });
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-4 max-w-sm">
      {/* Theme Detection Card */}
      <div className="card bg-base-100 shadow-lg border-2 border-primary">
        <div className="card-body p-4">
          <h3 className="card-title text-sm">🔍 Theme Debug Panel</h3>
          
          {/* CSS Custom Properties Test */}
          <div className="space-y-2 text-xs">
            <div className="font-semibold">CSS Custom Properties (OKLCH):</div>
            <div 
              className="p-2 rounded" 
              style={{ 
                backgroundColor: 'oklch(var(--color-primary))', 
                color: 'oklch(var(--color-primary-content))' 
              }}
            >
              Primary: Should be Cool Blue (#4a90e2)
            </div>
            <div 
              className="p-2 rounded" 
              style={{ 
                backgroundColor: 'oklch(var(--color-secondary))', 
                color: 'oklch(var(--color-secondary-content))' 
              }}
            >
              Secondary: Should be light blue-gray
            </div>
            <div 
              className="p-2 rounded" 
              style={{ 
                backgroundColor: 'oklch(var(--color-base-200))', 
                color: 'oklch(var(--color-base-content))' 
              }}
            >
              Base-200: Should be very light blue-gray
            </div>
          </div>

          {/* DaisyUI Classes Test */}
          <div className="space-y-2">
            <div className="font-semibold text-xs">DaisyUI Classes:</div>
            <button className="btn btn-primary btn-xs">Primary Button</button>
            <button className="btn btn-secondary btn-xs">Secondary Button</button>
            <div className="badge badge-primary badge-sm">Primary Badge</div>
            <div className="chat chat-start">
              <div className="chat-bubble chat-bubble-primary text-xs">
                Primary Chat Bubble
              </div>
            </div>
            <div className="chat chat-end">
              <div className="chat-bubble chat-bubble-secondary text-xs">
                Secondary Chat Bubble
              </div>
            </div>
          </div>

          {/* Theme Attribute Check */}
          <div className="space-y-1 text-xs">
            <div className="font-semibold">Theme Detection:</div>
            <div className="bg-base-200 p-2 rounded">
              <div>Current theme: <code className="text-primary">{
                document.documentElement.getAttribute('data-theme') || 
                document.querySelector('[data-theme]')?.getAttribute('data-theme') || 
                'none detected'
              }</code></div>
              <div>Expected: <code className="text-success">ea-theme</code></div>
            </div>
          </div>

          {/* CSS Variable Values */}
          <div className="space-y-1 text-xs">
            <div className="font-semibold">CSS Variables:</div>
            <div className="bg-base-200 p-2 rounded font-mono text-xs space-y-1">
              <div>--color-primary: <span className="text-primary">{cssVars.primary}</span></div>
              <div>--color-secondary: <span className="text-secondary">{cssVars.secondary}</span></div>
              <div>--color-base-100: <span>{cssVars.base100}</span></div>
              <div>--color-base-200: <span>{cssVars.base200}</span></div>
            </div>
          </div>

          {/* Manual Color Test */}
          <div className="space-y-2">
            <div className="font-semibold text-xs">Manual Color Test:</div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="bg-blue-500 text-white p-2 rounded text-center">
                Tailwind Blue
              </div>
              <div 
                className="text-white p-2 rounded text-center"
                style={{ backgroundColor: '#4a90e2' }}
              >
                Target: #4a90e2
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Close Button */}
      <button 
        className="btn btn-error btn-sm w-full"
        onClick={() => {
          const testPanel = document.querySelector('[data-testid="theme-test"]');
          if (testPanel) testPanel.remove();
        }}
      >
        Close Debug Panel
      </button>

    </div>
  );
}

// Hook version for React component lifecycle
export function useThemeDebug() {
  React.useEffect(() => {
    const root = document.querySelector('[data-theme="ea-theme"]') || document.documentElement;
    const styles = getComputedStyle(root);
    
    console.group('🎨 Theme Debug Info');
    console.log('Theme attribute:', document.querySelector('[data-theme]')?.getAttribute('data-theme') || 'not found');
    console.log('Primary (--p):', styles.getPropertyValue('--p').trim() || 'not found');
    console.log('Secondary (--s):', styles.getPropertyValue('--s').trim() || 'not found');
    console.log('Base-100 (--b1):', styles.getPropertyValue('--b1').trim() || 'not found');
    console.log('Base-200 (--b2):', styles.getPropertyValue('--b2').trim() || 'not found');
    console.log('Base-content (--bc):', styles.getPropertyValue('--bc').trim() || 'not found');
    console.groupEnd();
  }, []);
}