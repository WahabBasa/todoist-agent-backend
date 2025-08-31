#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting coordinated development workflow...');

// Step 1: Start Convex dev and wait for "functions ready"
console.log('📦 Step 1: Starting Convex backend...');

const convexProcess = spawn('npx', ['convex', 'dev'], {
  stdio: 'pipe',
  shell: true,
  cwd: __dirname
});

let convexReady = false;
let viteProcess = null;

// Monitor Convex output
convexProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output); // Forward output to console
  
  // Check for "Convex functions ready!" message
  if (output.includes('Convex functions ready!') && !convexReady) {
    convexReady = true;
    console.log('✅ Convex backend is ready! Starting frontend...');
    startVite();
  }
});

convexProcess.stderr.on('data', (data) => {
  process.stderr.write(data); // Forward errors to console
});

// Step 2: Start Vite once Convex is ready
function startVite() {
  console.log('🎨 Step 2: Starting Vite frontend server...');
  
  viteProcess = spawn('npx', ['vite', '--open'], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });

  viteProcess.on('close', (code) => {
    console.log(`🎨 Vite process exited with code ${code}`);
    if (convexProcess && !convexProcess.killed) {
      console.log('🛑 Stopping Convex process...');
      convexProcess.kill();
    }
    process.exit(code);
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Graceful shutdown initiated...');
  
  if (viteProcess && !viteProcess.killed) {
    console.log('🎨 Stopping Vite...');
    viteProcess.kill();
  }
  
  if (convexProcess && !convexProcess.killed) {
    console.log('📦 Stopping Convex...');
    convexProcess.kill();
  }
  
  process.exit(0);
});

// Handle Convex process errors
convexProcess.on('error', (error) => {
  console.error('❌ Failed to start Convex process:', error);
  process.exit(1);
});

convexProcess.on('close', (code) => {
  if (code !== 0) {
    console.log(`📦 Convex process exited with code ${code}`);
    if (viteProcess && !viteProcess.killed) {
      viteProcess.kill();
    }
    process.exit(code);
  }
});

// Timeout fallback (in case "functions ready" message is missed)
setTimeout(() => {
  if (!convexReady) {
    console.log('⏰ Timeout reached, starting Vite anyway...');
    console.log('💡 This may cause import errors if Convex generation is still in progress');
    startVite();
  }
}, 60000); // 60 second timeout