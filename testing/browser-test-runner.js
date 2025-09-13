/**
 * Browser-based TaskAI Testing Suite
 * Uses Puppeteer to interact with TaskAI web interface and run tests automatically
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';

class BrowserTestRunner {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'http://localhost:5174';
        this.headless = options.headless !== false; // Default to headless
        this.slowMo = options.slowMo || 1000; // Delay between actions
        this.browser = null;
        this.page = null;
        this.testResults = [];
    }

    async init() {
        console.log('🚀 Launching browser for TaskAI testing...');
        
        this.browser = await puppeteer.launch({
            headless: this.headless,
            slowMo: this.slowMo,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        this.page = await this.browser.newPage();
        
        // Set up page event listeners
        this.page.on('console', msg => {
            if (msg.text().includes('error') || msg.text().includes('Error')) {
                console.log('🔍 Browser console:', msg.text());
            }
        });
        
        await this.page.goto(this.baseUrl);
        console.log('✅ TaskAI page loaded');
    }

    async waitForTaskAI() {
        console.log('⏳ Waiting for TaskAI to be ready...');
        
        try {
            // Wait for chat interface elements to load
            await this.page.waitForSelector('textarea, input[type="text"]', { timeout: 30000 });
            console.log('✅ Chat interface detected');
            
            // Additional wait for any initialization
            await this.page.waitForTimeout(3000);
            return true;
        } catch (error) {
            console.error('❌ TaskAI interface not found:', error.message);
            return false;
        }
    }

    async sendMessage(message) {
        console.log(`📤 Sending: "${message}"`);
        
        try {
            // Find the input field (adjust selector based on actual TaskAI interface)
            const inputSelectors = [
                'textarea[placeholder*="message"]',
                'textarea[placeholder*="ask"]', 
                'textarea[placeholder*="chat"]',
                'input[type="text"]',
                'textarea',
                '[data-testid="chat-input"]'
            ];
            
            let inputElement = null;
            for (const selector of inputSelectors) {
                try {
                    inputElement = await this.page.$(selector);
                    if (inputElement) break;
                } catch (e) {
                    continue;
                }
            }
            
            if (!inputElement) {
                throw new Error('Chat input field not found');
            }
            
            // Clear and type message
            await inputElement.click({ clickCount: 3 }); // Select all
            await inputElement.type(message);
            
            // Find and click send button
            const sendSelectors = [
                'button[type="submit"]',
                'button:has-text("Send")',
                'button[aria-label*="send"]',
                '[data-testid="send-button"]',
                'button:last-of-type'
            ];
            
            let sendButton = null;
            for (const selector of sendSelectors) {
                try {
                    sendButton = await this.page.$(selector);
                    if (sendButton) break;
                } catch (e) {
                    continue;
                }
            }
            
            if (!sendButton) {
                // Try pressing Enter
                await inputElement.press('Enter');
            } else {
                await sendButton.click();
            }
            
            console.log('✅ Message sent');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to send message:', error.message);
            return false;
        }
    }

    async waitForResponse() {
        console.log('⏳ Waiting for TaskAI response...');
        
        try {
            // Wait for response indicators to appear/disappear
            const responseSelectors = [
                '[data-testid="message"]',
                '.message',
                '.assistant-message',
                '.response'
            ];
            
            // Wait a bit for the response to start
            await this.page.waitForTimeout(2000);
            
            // Wait for typing indicator to disappear (if present)
            try {
                await this.page.waitForSelector('.typing-indicator, .loading, .spinner', { 
                    hidden: true, 
                    timeout: 30000 
                });
            } catch (e) {
                // No typing indicator found, continue
            }
            
            // Get the latest response
            const response = await this.getLatestResponse();
            console.log('✅ Response received');
            return response;
            
        } catch (error) {
            console.error('❌ Timeout waiting for response:', error.message);
            return { text: 'ERROR: Response timeout', toolCalls: [] };
        }
    }

    async getLatestResponse() {
        try {
            // Try multiple selectors to find the response
            const responseSelectors = [
                '.message:last-child',
                '[data-testid="assistant-message"]:last-child',
                '.assistant-message:last-child',
                '.response:last-child'
            ];
            
            let responseElement = null;
            for (const selector of responseSelectors) {
                try {
                    responseElement = await this.page.$(selector);
                    if (responseElement) break;
                } catch (e) {
                    continue;
                }
            }
            
            if (!responseElement) {
                // Fallback: get all text from the chat area
                const chatText = await this.page.evaluate(() => {
                    const chatArea = document.querySelector('[data-testid="chat"], .chat, main, .messages');
                    return chatArea ? chatArea.innerText : 'No response found';
                });
                return { text: chatText, toolCalls: [] };
            }
            
            const responseText = await responseElement.evaluate(el => el.innerText || el.textContent);
            
            // Try to detect tool calls in the response
            const toolCalls = await this.detectToolCalls(responseText);
            
            return {
                text: responseText,
                toolCalls: toolCalls
            };
            
        } catch (error) {
            console.error('Error getting response:', error.message);
            return { text: 'ERROR: Could not extract response', toolCalls: [] };
        }
    }

    async detectToolCalls(responseText) {
        const toolCalls = [];
        
        // Look for common tool call indicators
        const toolPatterns = [
            /find.*tasks?.*due/i,
            /add.*task/i,
            /create.*task/i,
            /schedule.*meeting/i,
            /todoist/i,
            /calendar/i
        ];
        
        toolPatterns.forEach(pattern => {
            if (pattern.test(responseText)) {
                toolCalls.push(pattern.toString());
            }
        });
        
        // Also check browser network tab for actual API calls
        try {
            const requests = await this.page.evaluate(() => {
                return window.performance.getEntriesByType('resource')
                    .filter(entry => entry.name.includes('api') || entry.name.includes('convex'))
                    .map(entry => entry.name);
            });
            toolCalls.push(...requests);
        } catch (e) {
            // Network detection failed, continue
        }
        
        return toolCalls;
    }

    async runTest(testCase) {
        console.log(`\n🧪 Running ${testCase.id}: ${testCase.category}`);
        
        const startTime = Date.now();
        
        try {
            // Send the test query
            const sent = await this.sendMessage(testCase.query);
            if (!sent) {
                throw new Error('Failed to send message');
            }
            
            // Wait for and capture response
            const response = await this.waitForResponse();
            const endTime = Date.now();
            
            const result = {
                testId: testCase.id,
                category: testCase.category,
                query: testCase.query,
                timestamp: new Date().toISOString(),
                responseTime: endTime - startTime,
                response: response.text,
                toolCalls: response.toolCalls,
                expectedTools: testCase.expectedTools || [],
                expectTools: testCase.expectTools,
                score: this.scoreResponse(response, testCase),
                passed: false, // Will be set by scoreResponse
                notes: []
            };
            
            result.passed = result.score >= 3;
            console.log(`${result.passed ? '✅' : '❌'} Test ${testCase.id}: ${result.score}/5`);
            
            return result;
            
        } catch (error) {
            console.error(`❌ Test ${testCase.id} failed:`, error.message);
            return {
                testId: testCase.id,
                category: testCase.category,
                query: testCase.query,
                timestamp: new Date().toISOString(),
                responseTime: -1,
                response: `ERROR: ${error.message}`,
                toolCalls: [],
                score: 0,
                passed: false,
                notes: [`Error: ${error.message}`]
            };
        }
    }

    scoreResponse(response, testCase) {
        let score = 3; // Start with average
        
        // Check if response contains error indicators
        if (response.text.toLowerCase().includes('error') || 
            response.text.toLowerCase().includes('sorry, i cannot')) {
            score -= 2;
        }
        
        // Check response length appropriateness
        if (response.text.length < 20) {
            score -= 1;
        } else if (response.text.length > 50) {
            score += 1;
        }
        
        // Check tool usage appropriateness
        const hasToolCalls = response.toolCalls.length > 0;
        if (testCase.expectTools && hasToolCalls) {
            score += 1;
        } else if (!testCase.expectTools && !hasToolCalls) {
            score += 1;
        } else {
            score -= 1;
        }
        
        return Math.max(1, Math.min(5, score));
    }

    async runAllTests() {
        console.log('🚀 Starting automated TaskAI testing with browser interface');
        
        if (!await this.waitForTaskAI()) {
            throw new Error('TaskAI interface not ready');
        }
        
        // Get test cases (same as automated runner)
        const testCases = this.getTestCases();
        
        // Run each phase
        for (const phaseName in testCases) {
            console.log(`\n📋 Starting ${phaseName.toUpperCase().replace('_', ' ')}`);
            console.log('═'.repeat(60));
            
            for (const testCase of testCases[phaseName]) {
                const result = await this.runTest(testCase);
                this.testResults.push(result);
                
                // Wait between tests to avoid overwhelming the system
                await this.page.waitForTimeout(2000);
            }
        }
        
        await this.generateReport();
    }

    getTestCases() {
        return {
            phase1_general: [
                {
                    id: "T1.1",
                    query: "Explain quantum computing in simple terms",
                    category: "General Science",
                    expectTools: false
                },
                {
                    id: "T1.2", 
                    query: "What are the latest developments in AI research as of 2025?",
                    category: "Current Events",
                    expectTools: false
                }
            ],
            phase2_tools: [
                {
                    id: "T2.1",
                    query: "What tasks do I have due today?",
                    category: "Basic Task Query", 
                    expectTools: true,
                    expectedTools: ["todoist", "tasks"]
                },
                {
                    id: "T2.3",
                    query: "Remind me to call John tomorrow at 3 PM",
                    category: "Task Creation",
                    expectTools: true,
                    expectedTools: ["todoist", "add-tasks"]
                }
            ]
        };
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            totalTests: this.testResults.length,
            passed: this.testResults.filter(r => r.passed).length,
            results: this.testResults
        };
        
        await fs.writeFile('./browser-test-results.json', JSON.stringify(report, null, 2));
        
        console.log('\n🎉 Browser testing completed!');
        console.log(`📊 Results: ${report.passed}/${report.totalTests} tests passed`);
        console.log('📄 Detailed results saved to browser-test-results.json');
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log('🔒 Browser closed');
        }
    }
}

// CLI interface
if (process.argv[1].endsWith('browser-test-runner.js')) {
    const runner = new BrowserTestRunner({
        baseUrl: process.argv[2] || 'http://localhost:5174',
        headless: false // Show browser for debugging
    });
    
    runner.init()
        .then(() => runner.runAllTests())
        .finally(() => runner.cleanup())
        .catch(console.error);
}

export default BrowserTestRunner;