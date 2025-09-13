# 🚀 TaskAI Automated Testing Suite

## Quick Start

### 1. **One-Click Testing** 
```bash
# Double-click this file:
run-tests.bat
```

### 2. **Manual Testing Options**

#### Browser Testing (Visual)
```bash
cd testing
npm install
node browser-test-runner.js
```

#### API Testing (Fast)  
```bash
cd testing
npm install
node automated-test-runner.js
```

---

## What This Does

### 🎯 **Automated Test Execution**
- **34 comprehensive test cases** across 3 categories
- **Real system interaction** - tests your actual TaskAI
- **Automatic scoring** - 1-5 scale for each test
- **Detailed reports** - JSON and readable markdown formats

### 📊 **Test Categories**

#### 1. **General Knowledge** (8 tests)
- Science explanations
- Technology concepts  
- Creative tasks
- Problem solving
- **Goal**: Verify quality without inappropriate tool usage

#### 2. **Tool Usage Proficiency** (12 tests)
- Basic task queries: "What tasks are due today?"
- Task creation: "Remind me to call John tomorrow"
- Calendar scheduling
- Out-of-scope handling
- **Goal**: Test tool selection logic and execution

#### 3. **Data Accuracy** (14 tests)
- Complex task creation with multiple attributes
- Batch operations
- Priority, date, tag, project assignment
- **Goal**: Verify precise data handling

---

## 📁 Output Files

After running tests, you'll get:

### **test-results-automated.json**
```json
{
  "metadata": {
    "model": "claude-3-haiku",
    "startTime": "2025-09-13T20:52:00.000Z",
    "totalTests": 34
  },
  "summary": {
    "passed": 28,
    "failed": 6, 
    "passRate": 82,
    "averageScore": 3.8
  },
  "results": [...]
}
```

### **test-results-readable.md**
```markdown
# TaskAI Test Results - claude-3-haiku

## Test Summary
- Overall Score: 3.8/5
- Pass Rate: 82% (28/34)

## Phase Results
### General Knowledge: 4.2/5 ✅
### Tool Usage: 4.1/5 ✅ 
### Data Accuracy: 2.9/5 ⚠️

## Recommendations
- 🔴 Data accuracy needs improvement
- 🟡 Consider model upgrade for complex tasks
```

### **browser-test-results.json**
Visual browser testing results with actual UI interaction data.

---

## 🔧 System Requirements

### **Prerequisites**
- TaskAI running on `http://localhost:5174`
- Node.js installed
- Internet connection for dependencies

### **Setup TaskAI**
```bash
cd "C:\Users\AtheA\Desktop\Personal_Programs\todoist-agent-backend\ea-ai-main2\ea-ai-main2"
npm run dev
# Wait for "Local: http://localhost:5174/"
```

### **Run Tests**
```bash
cd testing
./run-tests.bat
```

---

## 🎯 Test Examples

### **Simple Test**
```
Query: "What tasks do I have due today?"
Expected: Uses Todoist API to fetch tasks
Scoring: 5/5 if correct tool used, 1/5 if no tools used
```

### **Complex Test**  
```
Query: "Create a high-priority task 'Review Q4 budget' due December 15th at 2 PM with tags 'finance' and 'urgent', assign it to the 'Work Projects' project"

Verification:
✅ Task name: "Review Q4 budget"
✅ Priority: High (1)  
✅ Due date: 2025-12-15
✅ Due time: 14:00
✅ Tags: ["finance", "urgent"] 
✅ Project: "Work Projects"

Scoring: 5/5 if all correct, 1/5 if major issues
```

---

## 🛠️ Customization

### **Add New Tests**
Edit `automated-test-runner.js`:
```javascript
phase1_general: [
    {
        id: "T1.9",
        query: "Your new test query here",
        category: "Your Category",
        expectTools: false,
        expectedScore: { min: 3, target: 4 }
    }
]
```

### **Modify Scoring**
Edit the `analyzeResponse()` function to change how tests are scored.

### **Change Target URL**
```bash
node automated-test-runner.js http://your-url:port
```

---

## 🔍 Troubleshooting

### **"TaskAI not running"**
```bash
# Start TaskAI first
cd "ea-ai-main2\ea-ai-main2"
npm run dev
```

### **"Dependencies not found"**
```bash
cd testing
npm install
```

### **"Tests failing unexpectedly"**
- Check TaskAI is responding in browser first
- Verify Claude Haiku 3 is selected as model
- Check Todoist integration is connected

### **"Browser tests not working"**
```bash
# Try headless mode
node browser-test-runner.js --headless
```

---

## 📈 Interpreting Results

### **Score Meanings**
- **5/5**: Perfect execution, meets all criteria
- **4/5**: Good quality, minor issues  
- **3/5**: Acceptable, some problems
- **2/5**: Below standard, significant issues
- **1/5**: Poor/failed execution

### **Pass/Fail Criteria**
- **Pass**: Score ≥ 3/5
- **Fail**: Score < 3/5

### **Success Benchmarks**
- **General Knowledge**: Target >3.5/5 average
- **Tool Usage**: Target >4.0/5 average
- **Data Accuracy**: Target >3.0/5 average
- **Overall**: Target >80% pass rate

---

This automated testing suite gives you comprehensive evaluation of your TaskAI system with minimal manual effort. Just run the tests and get detailed insights into performance across all critical dimensions!