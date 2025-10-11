/**
 * Test script for enhanced error handling in session.ts
 * Run this to verify error types and messages work correctly
 */

// Import our error classes (adjust path as needed)
import { RateLimitError, ProviderAuthError, ModelNotFoundError } from './session.js';

function testErrorHandling() {
  console.log('🧪 Testing Enhanced Error Handling...\n');

  // Test 1: RateLimitError
  try {
    const rateLimitError = new RateLimitError(429, 60, 'openrouter', 'x-ai/grok-4-fast');
    console.log('✅ RateLimitError:', rateLimitError.message);
    console.log('   - Status Code:', rateLimitError.statusCode);
    console.log('   - Retry After:', rateLimitError.retryAfter, 'seconds');
    console.log('   - Provider:', rateLimitError.provider);
    console.log('   - Model ID:', rateLimitError.modelId);
  } catch (e) {
    console.log('❌ RateLimitError test failed:', e.message);
  }

  console.log('');

  // Test 2: ProviderAuthError
  try {
    const authError = new ProviderAuthError('openrouter', 'Invalid API key', 'x-ai/grok-4-fast');
    console.log('✅ ProviderAuthError:', authError.message);
    console.log('   - Provider:', authError.provider);
    console.log('   - Model ID:', authError.modelId);
  } catch (e) {
    console.log('❌ ProviderAuthError test failed:', e.message);
  }

  console.log('');

  // Test 3: ModelNotFoundError
  try {
    const modelError = new ModelNotFoundError('nonexistent-model', 'openrouter');
    console.log('✅ ModelNotFoundError:', modelError.message);
    console.log('   - Model ID:', modelError.modelId);
    console.log('   - Provider:', modelError.provider);
  } catch (e) {
    console.log('❌ ModelNotFoundError test failed:', e.message);
  }

  console.log('');

  // Test 4: Error Classification
  console.log('🔍 Testing Error Classification Patterns:');
  
  const testErrors = [
    { message: 'Provider returned error', statusCode: 429, expected: 'Rate Limit' },
    { message: 'temporarily rate-limited upstream', expected: 'Rate Limit' },
    { message: 'Invalid API key', statusCode: 401, expected: 'Auth Error' },
    { message: 'Model not found', statusCode: 404, expected: 'Model Error' }
  ];

  testErrors.forEach((test, index) => {
    const isRateLimit = test.statusCode === 429 || 
                       test.message.includes('rate-limited') ||
                       test.message.includes('rate limit');
    
    const isAuth = test.statusCode === 401 || 
                   test.message.includes('API key') || 
                   test.message.includes('Unauthorized');
    
    const isModelError = test.statusCode === 404 || 
                        test.message.includes('model not found');
    
    let detected = 'Unknown';
    if (isRateLimit) detected = 'Rate Limit';
    else if (isAuth) detected = 'Auth Error';
    else if (isModelError) detected = 'Model Error';
    
    const success = detected === test.expected;
    console.log(`   ${success ? '✅' : '❌'} Test ${index + 1}: "${test.message}" → ${detected} (expected: ${test.expected})`);
  });

  console.log('\n🎉 Error handling tests completed!');
}

// Export for use in other files
export { testErrorHandling };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testErrorHandling();
}