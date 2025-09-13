/**
 * Automated TaskAI Testing Suite
 * Runs tests programmatically against the TaskAI system and generates results
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

class TaskAITestRunner {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'http://localhost:5174';
        this.apiEndpoint = options.apiEndpoint || '/api/chat'; // Adjust based on actual API
        this.resultFile = options.resultFile || './test-results-automated.json';
        this.model = options.model || 'claude-3-haiku';
        this.testResults = [];
        this.startTime = new Date();
    }

    // Test case definitions
    getTestCases() {
        return {
            phase1_general: [
                {
                    id: "T1.1",
                    query: "Explain quantum computing in simple terms",
                    category: "General Science",
                    expectTools: false,
                    expectedScore: { min: 3, target: 4 }
                },
                {
                    id: "T1.2",
                    query: "What are the latest developments in AI research as of 2025?",
                    category: "Current Events", 
                    expectTools: false,
                    expectedScore: { min: 3, target: 4 }
                },
                {
                    id: "T1.3",
                    query: "How does blockchain technology work?",
                    category: "Technology Concepts",
                    expectTools: false,
                    expectedScore: { min: 3, target: 4 }
                },
                {
                    id: "T1.4",
                    query: "Explain the differences between React and Vue.js",
                    category: "Programming Topics",
                    expectTools: false,
                    expectedScore: { min: 3, target: 4 }
                },
                {
                    id: "T1.5", 
                    query: "Help me brainstorm names for a tech startup focused on sustainable energy",
                    category: "Creative Brainstorming",
                    expectTools: false,
                    expectedScore: { min: 2, target: 3 }
                },
                {
                    id: "T1.6",
                    query: "Write a short poem about autumn leaves",
                    category: "Creative Writing",
                    expectTools: false,
                    expectedScore: { min: 2, target: 3 }
                },
                {
                    id: "T1.7",
                    query: "How would you solve traffic congestion in a major city like New York?",
                    category: "Problem Solving",
                    expectTools: false,
                    expectedScore: { min: 3, target: 4 }
                },
                {
                    id: "T1.8",
                    query: "Create a simple recipe for chocolate chip cookies that takes under 30 minutes",
                    category: "Practical Knowledge",
                    expectTools: false,
                    expectedScore: { min: 3, target: 4 }
                }
            ],
            
            phase2_tools: [
                {
                    id: "T2.1",
                    query: "What tasks do I have due today?",
                    category: "Basic Task Query",
                    expectTools: true,
                    expectedTools: ["find-tasks-by-date", "todoist"],
                    expectedScore: { min: 4, target: 5 }
                },
                {
                    id: "T2.2",
                    query: "Schedule a team meeting for next Wednesday at 2 PM",
                    category: "Calendar Scheduling",
                    expectTools: true,
                    expectedTools: ["calendar", "add-tasks"],
                    expectedScore: { min: 3, target: 4 }
                },
                {
                    id: "T2.3",
                    query: "Remind me to call John tomorrow at 3 PM",
                    category: "Task Creation",
                    expectTools: true,
                    expectedTools: ["add-tasks", "todoist"],
                    expectedScore: { min: 4, target: 5 },
                    verification: {
                        checkTodoist: true,
                        expectedTask: "call John",
                        expectedDue: "tomorrow 3 PM"
                    }
                },
                {
                    id: "T2.4", 
                    query: "What's the weather like today?",
                    category: "Out-of-Scope",
                    expectTools: false,
                    expectedScore: { min: 4, target: 5 }
                }
            ],
            
            phase3_data: [
                {
                    id: "T3.1",
                    query: "Create a high-priority task 'Review Q4 budget' due December 15th at 2 PM with tags 'finance' and 'urgent', assign it to the 'Work Projects' project",
                    category: "Multi-Attribute Task",
                    expectTools: true,
                    expectedTools: ["add-tasks"],
                    expectedScore: { min: 2, target: 4 },
                    verification: {
                        checkTodoist: true,
                        expectedTask: "Review Q4 budget",
                        expectedPriority: 1,
                        expectedDue: "2025-12-15 14:00",
                        expectedTags: ["finance", "urgent"],
                        expectedProject: "Work Projects"
                    }
                },
                {
                    id: "T3.2",
                    query: `Add these tasks to my 'Home Improvement' project:
- Paint living room (priority 2, due next Friday, tag: painting)  
- Buy supplies for bathroom renovation (priority 4, due tomorrow, tags: shopping, bathroom)
- Schedule contractor consultation (priority 1, due this week, tag: contractors)`,
                    category: "Batch Task Creation",
                    expectTools: true,
                    expectedTools: ["add-tasks"],
                    expectedScore: { min: 2, target: 3 },
                    verification: {
                        checkTodoist: true,
                        expectedTaskCount: 3,
                        expectedProject: "Home Improvement"
                    }
                }
            ]
        };
    }

    // Execute a single test case
    async executeTest(testCase) {
        const startTime = Date.now();
        console.log(`\n🧪 Executing ${testCase.id}: ${testCase.category}`);
        console.log(`📝 Query: "${testCase.query}"`);
        
        try {
            // Make request to TaskAI system
            const response = await this.sendQuery(testCase.query);
            const endTime = Date.now();
            
            const result = {
                testId: testCase.id,
                category: testCase.category,
                query: testCase.query,
                timestamp: new Date().toISOString(),
                responseTime: endTime - startTime,
                response: response.text || response.message || JSON.stringify(response),
                toolCalls: response.toolCalls || [],
                expectedTools: testCase.expectedTools || [],
                expectTools: testCase.expectTools,
                verification: testCase.verification || null,
                score: null, // Will be calculated
                passed: false, // Will be determined
                notes: []
            };

            // Analyze the response
            await this.analyzeResponse(result, testCase);
            
            console.log(`✅ Test ${testCase.id} completed - Score: ${result.score}/5`);
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
                notes: [`Execution error: ${error.message}`]
            };
        }
    }

    // Send query to TaskAI system
    async sendQuery(query) {
        // This needs to be adapted based on your actual TaskAI API
        try {
            const response = await fetch(`${this.baseUrl}${this.apiEndpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: query,
                    model: this.model,
                    sessionId: `test-session-${Date.now()}`
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            // Fallback - if direct API doesn't work, we'll need to use browser automation
            console.warn('Direct API call failed, may need browser automation');
            throw error;
        }
    }

    // Analyze response quality and tool usage
    async analyzeResponse(result, testCase) {
        let score = 0;
        const notes = [];

        // Check tool usage appropriateness
        const toolsUsed = result.toolCalls.length > 0;
        if (testCase.expectTools && !toolsUsed) {
            notes.push("❌ Expected tool usage but none detected");
            score -= 2;
        } else if (!testCase.expectTools && toolsUsed) {
            notes.push("❌ Unexpected tool usage for general query");  
            score -= 2;
        } else if (testCase.expectTools && toolsUsed) {
            notes.push("✅ Appropriate tool usage detected");
            score += 1;
        } else {
            notes.push("✅ Correctly avoided tool usage");
            score += 1;
        }

        // Check response quality
        const responseLength = result.response.length;
        if (responseLength < 50) {
            notes.push("⚠️ Response seems too brief");
            score -= 1;
        } else if (responseLength > 2000) {
            notes.push("⚠️ Response seems excessively long");
            score -= 0.5;
        } else {
            score += 1;
        }

        // Content quality assessment (basic)
        const response = result.response.toLowerCase();
        if (response.includes('error') || response.includes('sorry, i cannot')) {
            notes.push("❌ Error or inability expressed in response");
            score -= 2;
        } else {
            score += 1;
        }

        // Tool call accuracy (if applicable)
        if (testCase.expectTools && testCase.expectedTools) {
            const expectedToolsFound = testCase.expectedTools.some(tool => 
                result.toolCalls.some(call => call.includes(tool))
            );
            if (expectedToolsFound) {
                notes.push("✅ Expected tools were used");
                score += 2;
            } else {
                notes.push("❌ Expected tools not found in tool calls");
                score -= 1;
            }
        }

        // Normalize score to 1-5 range
        result.score = Math.max(1, Math.min(5, Math.round(3 + score)));
        result.passed = result.score >= (testCase.expectedScore?.min || 3);
        result.notes = notes;
    }

    // Run complete test suite
    async runAllTests() {
        console.log(`🚀 Starting TaskAI Test Suite with ${this.model}`);
        console.log(`🎯 Target: ${this.baseUrl}`);
        console.log(`⏰ Started at: ${this.startTime.toLocaleString()}\n`);

        const testCases = this.getTestCases();
        const allTests = [
            ...testCases.phase1_general,
            ...testCases.phase2_tools,
            ...testCases.phase3_data
        ];

        console.log(`📊 Total tests to run: ${allTests.length}\n`);

        // Execute tests in phases
        for (const phase in testCases) {
            console.log(`\n🔄 Starting ${phase.toUpperCase().replace('_', ' ')}`);
            console.log('═'.repeat(50));
            
            for (const testCase of testCases[phase]) {
                const result = await this.executeTest(testCase);
                this.testResults.push(result);
                
                // Small delay between tests
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        await this.generateReport();
    }

    // Generate comprehensive test report
    async generateReport() {
        const endTime = new Date();
        const duration = endTime - this.startTime;
        
        const summary = this.calculateSummary();
        
        const report = {
            metadata: {
                model: this.model,
                startTime: this.startTime.toISOString(),
                endTime: endTime.toISOString(),
                duration: `${Math.round(duration / 1000)}s`,
                totalTests: this.testResults.length
            },
            summary,
            results: this.testResults,
            recommendations: this.generateRecommendations(summary)
        };

        // Save detailed results
        await fs.writeFile(this.resultFile, JSON.stringify(report, null, 2));
        
        // Generate readable report
        await this.generateReadableReport(report);
        
        console.log('\n🎉 Testing completed!');
        console.log(`📄 Results saved to: ${this.resultFile}`);
        console.log(`📊 Summary: ${summary.passed}/${summary.total} tests passed (${summary.passRate}%)`);
        console.log(`⭐ Overall score: ${summary.averageScore}/5`);
    }

    calculateSummary() {
        const total = this.testResults.length;
        const passed = this.testResults.filter(r => r.passed).length;
        const scores = this.testResults.map(r => r.score);
        const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        
        const byPhase = {
            general: this.testResults.filter(r => r.testId.startsWith('T1')),
            tools: this.testResults.filter(r => r.testId.startsWith('T2')), 
            data: this.testResults.filter(r => r.testId.startsWith('T3'))
        };

        return {
            total,
            passed,
            failed: total - passed,
            passRate: Math.round((passed / total) * 100),
            averageScore: Math.round(averageScore * 100) / 100,
            phases: {
                general: {
                    passed: byPhase.general.filter(r => r.passed).length,
                    total: byPhase.general.length,
                    averageScore: byPhase.general.reduce((sum, r) => sum + r.score, 0) / byPhase.general.length
                },
                tools: {
                    passed: byPhase.tools.filter(r => r.passed).length,
                    total: byPhase.tools.length,
                    averageScore: byPhase.tools.reduce((sum, r) => sum + r.score, 0) / byPhase.tools.length
                },
                data: {
                    passed: byPhase.data.filter(r => r.passed).length,
                    total: byPhase.data.length,
                    averageScore: byPhase.data.reduce((sum, r) => sum + r.score, 0) / byPhase.data.length
                }
            }
        };
    }

    generateRecommendations(summary) {
        const recommendations = [];
        
        if (summary.phases.general.averageScore < 3.5) {
            recommendations.push("🔴 General knowledge responses need improvement - consider model upgrade");
        }
        
        if (summary.phases.tools.averageScore < 4.0) {
            recommendations.push("🟡 Tool usage logic needs refinement - review tool selection criteria");
        }
        
        if (summary.phases.data.averageScore < 3.0) {
            recommendations.push("🔴 Data accuracy is poor - implement enhanced parameter extraction");
        }
        
        if (summary.passRate < 80) {
            recommendations.push("🔴 Overall pass rate is below acceptable threshold - major improvements needed");
        }
        
        return recommendations;
    }

    async generateReadableReport(report) {
        const readable = `
# TaskAI Test Results - ${report.metadata.model}

## Test Summary
- **Model**: ${report.metadata.model}
- **Date**: ${new Date(report.metadata.startTime).toLocaleString()}
- **Duration**: ${report.metadata.duration}
- **Overall Score**: ${report.summary.averageScore}/5
- **Pass Rate**: ${report.summary.passRate}% (${report.summary.passed}/${report.summary.total})

## Phase Results

### General Knowledge
- Score: ${Math.round(report.summary.phases.general.averageScore * 100) / 100}/5
- Pass Rate: ${Math.round((report.summary.phases.general.passed / report.summary.phases.general.total) * 100)}%

### Tool Usage  
- Score: ${Math.round(report.summary.phases.tools.averageScore * 100) / 100}/5
- Pass Rate: ${Math.round((report.summary.phases.tools.passed / report.summary.phases.tools.total) * 100)}%

### Data Accuracy
- Score: ${Math.round(report.summary.phases.data.averageScore * 100) / 100}/5
- Pass Rate: ${Math.round((report.summary.phases.data.passed / report.summary.phases.data.total) * 100)}%

## Recommendations
${report.recommendations.map(r => `- ${r}`).join('\n')}

## Detailed Results
${report.results.map(r => `
### ${r.testId} - ${r.category}
**Query**: ${r.query}
**Score**: ${r.score}/5 ${r.passed ? '✅' : '❌'}
**Response Time**: ${r.responseTime}ms
**Notes**: ${r.notes.join(', ')}
`).join('\n')}
        `;
        
        await fs.writeFile('./test-results-readable.md', readable.trim());
    }
}

// CLI interface
if (process.argv[1].endsWith('automated-test-runner.js')) {
    const runner = new TaskAITestRunner({
        baseUrl: process.argv[2] || 'http://localhost:5174',
        model: 'claude-3-haiku'
    });
    
    runner.runAllTests().catch(console.error);
}

export default TaskAITestRunner;