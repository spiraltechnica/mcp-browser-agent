import { BrowserMCPServer, MCPToolInfo } from './mcp-server';

export interface AgentDecision {
  action: 'tool' | 'stop' | 'wait' | 'user_input';
  tool?: string;
  params?: any;
  delay?: number;
  reasoning?: string;
  prompt?: string; // For user_input action
}

export interface AgentContext {
  lastResults: Map<string, any>;
  executionCount: number;
  errors: string[];
  startTime: number;
}

export class ContextManager {
  private context = new Map<string, any>();
  private maxEntries = 50;

  update(key: string, value: any): void {
    if (this.context.size >= this.maxEntries) {
      const firstKey = this.context.keys().next().value;
      if (firstKey !== undefined) {
        this.context.delete(firstKey);
      }
    }
    this.context.set(key, value);
  }

  getRelevantContext(toolName?: string): any {
    const entries = Array.from(this.context.entries());
    
    if (toolName) {
      // Return context relevant to the current tool
      const relevantEntries = entries
        .filter(([key]) => this.isRelevant(key, toolName))
        .slice(-10); // Last 10 relevant entries
      return Object.fromEntries(relevantEntries);
    }
    
    // Return recent context
    return Object.fromEntries(entries.slice(-20));
  }

  private isRelevant(key: string, toolName: string): boolean {
    return key.includes(toolName) || 
           key.includes('last_') || 
           key.includes('error') ||
           key.includes('result');
  }

  clear(): void {
    this.context.clear();
  }

  size(): number {
    return this.context.size;
  }
}

export class MCPAgent {
  private isRunning = false;
  private mcpServer: BrowserMCPServer;
  private contextManager = new ContextManager();
  private context: AgentContext;
  private onLog: (message: string) => void;
  private maxExecutions = 100; // Prevent infinite loops
  private executionDelay = 3000; // Default delay between executions
  private waitingForUserInput = false;
  private userInputPrompt = '';
  private userInputResolver: ((input: string) => void) | null = null;
  private recentToolCalls: Array<{tool: string, params: any, timestamp: number}> = [];
  private maxRecentCalls = 10; // Track last 10 tool calls
  private loopDetectionThreshold = 3; // Stop if same call repeated 3 times

  constructor(mcpServer: BrowserMCPServer, onLog: (message: string) => void) {
    this.mcpServer = mcpServer;
    this.onLog = onLog;
    this.context = {
      lastResults: new Map(),
      executionCount: 0,
      errors: [],
      startTime: Date.now()
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.log("Agent is already running");
      return;
    }

    this.isRunning = true;
    this.context.startTime = Date.now();
    this.context.executionCount = 0;
    this.context.errors = [];
    
    this.log("🤖 MCP Agent starting...");

    try {
      await this.mcpServer.initialize();
      this.log("✅ MCP Server initialized");
      
      while (this.isRunning && this.context.executionCount < this.maxExecutions) {
        try {
          const decision = await this.makeDecision();
          
          if (decision.action === 'stop') {
            this.log(`🛑 Agent stopping: ${decision.reasoning || 'No reason provided'}`);
            break;
          }
          
          if (decision.action === 'wait') {
            this.log(`⏸️ Agent waiting: ${decision.reasoning || 'Waiting for conditions'}`);
            await this.sleep(decision.delay || this.executionDelay);
            continue;
          }
          
          if (decision.action === 'tool' && decision.tool) {
            await this.executeTool(decision.tool, decision.params || {});
          }
          
          await this.sleep(decision.delay || this.executionDelay);
          
        } catch (error) {
          this.handleError(error);
          await this.sleep(this.executionDelay);
        }
      }
      
      if (this.context.executionCount >= this.maxExecutions) {
        this.log(`⚠️ Agent stopped: Maximum executions (${this.maxExecutions}) reached`);
      }
      
    } catch (error) {
      this.handleError(error);
    } finally {
      this.isRunning = false;
      this.log("🏁 Agent stopped");
    }
  }

  stop(): void {
    if (!this.isRunning) {
      this.log("Agent is not running");
      return;
    }
    
    this.isRunning = false;
    this.log("🛑 Agent stop requested");
  }

  private async makeDecision(): Promise<AgentDecision> {
    try {
      const availableTools = await this.mcpServer.listTools();
      const relevantContext = this.contextManager.getRelevantContext();
      
      const prompt = this.buildPrompt(availableTools, relevantContext);
      
      const response = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
      }

      const decision = await this.parseDecisionResponse(response);
      this.log(`🧠 Decision: ${decision.action}${decision.tool ? ` (${decision.tool})` : ''}`);
      
      return decision;
      
    } catch (error) {
      this.log(`❌ Decision making failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Fallback decision
      return {
        action: 'tool',
        tool: 'list_tools',
        params: {},
        delay: 5000,
        reasoning: 'Fallback to list tools due to decision error'
      };
    }
  }

  private buildPrompt(tools: MCPToolInfo[], context: any): string {
    const contextStr = Object.keys(context).length > 0 ? JSON.stringify(context, null, 2) : "No previous context";
    const hasListedTools = context.last_list_tools !== undefined;
    const executionCount = this.context.executionCount;
    const recentErrors = this.context.errors.slice(-3);
    
    // Analyze recent failures to avoid repeating them
    const failedCalculatorExpressions = recentErrors
      .filter(err => err.includes('calculator') && err.includes('Invalid'))
      .map(err => {
        const match = err.match(/expression[^:]*:\s*(.+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean);
    
    const hasRepeatedFailures = recentErrors.length >= 2 && 
      recentErrors.every(err => err.includes('calculator') && err.includes('Invalid'));

    // Build detailed tool information with schemas and examples
    const toolDetails = tools.map(tool => {
      let examples = '';
      switch (tool.name) {
        case 'calculator':
          examples = `
  Examples:
  - {"expression": "2 + 2"}
  - {"expression": "10 * 5 + 3"}
  - {"expression": "sqrt(16)"}`;
          break;
        case 'dom_query':
          examples = `
  Examples:
  - {"selector": "button", "action": "exists"}
  - {"selector": "h1", "action": "text"}
  - {"selector": "#myButton", "action": "click"}
  - {"selector": "input[type='text']", "action": "value"}`;
          break;
        case 'browser_storage':
          examples = `
  Examples:
  - {"action": "set", "key": "counter", "value": "1"}
  - {"action": "get", "key": "counter"}
  - {"action": "keys"}
  - {"action": "remove", "key": "counter"}
  - {"action": "clear"}`;
          break;
        case 'list_tools':
          examples = `
  Examples:
  - {} (no parameters needed)`;
          break;
      }
      
      return `
🔧 ${tool.name}
   Description: ${tool.description}
   Required Parameters: ${JSON.stringify(tool.inputSchema, null, 2)}${examples}`;
    }).join('\n');
    
    return `
You are an intelligent MCP agent running in a browser. Your goal is to demonstrate your capabilities by using the available tools in interesting ways.

EXECUTION CONTEXT:
- Execution count: ${executionCount}
- Runtime: ${Math.round((Date.now() - this.context.startTime) / 1000)}s
- Recent errors: ${recentErrors.join(', ') || 'None'}
- Tools already discovered: ${hasListedTools ? 'Yes' : 'No'}
- Repeated failures detected: ${hasRepeatedFailures ? 'Yes - CHANGE STRATEGY!' : 'No'}

PREVIOUS CONTEXT:
${contextStr}

AVAILABLE TOOLS WITH EXACT SCHEMAS:${toolDetails}

CRITICAL PARAMETER RULES:
⚠️ ALWAYS use the EXACT parameter names from the schemas above!
⚠️ NEVER guess parameter names - follow the schemas precisely!
⚠️ For dom_query: use "selector" and "action" (NOT "query")
⚠️ For browser_storage: ALWAYS include "action" parameter first
⚠️ For calculator: use "expression" parameter

CRITICAL BEHAVIORAL RULES:
1. DON'T repeat failed actions - if something failed multiple times, try something else!
2. DON'T call "list_tools" more than once - you already know what tools are available
3. LEARN from errors - if a tool failed, check the schema and use correct parameters
4. VARY your actions - don't repeat the same tool/params over and over
5. STOP after 10-15 meaningful actions OR if stuck in error loops

${hasRepeatedFailures ? `
⚠️ WARNING: You've been repeating failed expressions!
${failedCalculatorExpressions.length > 0 ? `Failed expressions: ${failedCalculatorExpressions.join(', ')}` : ''}
IMMEDIATELY try a different tool or different parameters!
` : ''}

SUGGESTED ACTIONS (pick one that you haven't tried or failed recently):
${hasRepeatedFailures ? 
  `- Try dom_query: {"selector": "button", "action": "exists"}
- Try browser_storage: {"action": "set", "key": "test", "value": "hello"}
- Try simple calculator: {"expression": "10 + 5"}
- Use "stop" to end if too many failures` :
  `- Use calculator: {"expression": "10 + 5"} or {"expression": "3 * 4"}
- Use dom_query: {"selector": "h1", "action": "text"} or {"selector": "button", "action": "exists"}
- Use browser_storage: {"action": "set", "key": "timestamp", "value": "${Date.now()}"}
- Use browser_storage: {"action": "keys"} to see stored data`}
- Use "stop" if you've demonstrated enough capabilities (after 8+ actions)

INSTRUCTIONS:
Respond with valid JSON in this format:
{
  "action": "tool|stop",
  "tool": "tool_name_if_using_tool", 
  "params": { "exact_param_name": "value" },
  "delay": 2000,
  "reasoning": "Brief explanation of your decision"
}

Make a smart decision using EXACT parameter names from the schemas above:`.trim();
  }

  private async parseDecisionResponse(response: Response): Promise<AgentDecision> {
    try {
      const text = await response.text();
      
      // Try to parse as JSON first
      try {
        const parsed = JSON.parse(text);
        return this.validateDecision(parsed);
      } catch {
        // Try to extract JSON from text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return this.validateDecision(parsed);
        }
        
        throw new Error("No valid JSON found in response");
      }
    } catch (error) {
      this.log(`⚠️ Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Return a safe fallback decision
      return {
        action: 'tool',
        tool: 'list_tools',
        params: {},
        delay: 5000,
        reasoning: 'Fallback due to parsing error'
      };
    }
  }

  private validateDecision(decision: any): AgentDecision {
    if (!decision || typeof decision !== 'object') {
      throw new Error("Decision must be an object");
    }
    
    if (!['tool', 'wait', 'stop'].includes(decision.action)) {
      throw new Error("Invalid action");
    }
    
    if (decision.action === 'tool' && !decision.tool) {
      throw new Error("Tool name required for tool action");
    }
    
    return {
      action: decision.action,
      tool: decision.tool,
      params: decision.params || {},
      delay: Math.max(1000, Math.min(10000, decision.delay || 3000)), // Clamp delay
      reasoning: decision.reasoning || 'No reasoning provided'
    };
  }

  private async executeTool(toolName: string, params: any): Promise<void> {
    try {
      // Check for infinite loops BEFORE executing
      if (this.detectLoop(toolName, params)) {
        this.log(`🔄 Loop detected for ${toolName} with same params. Stopping agent to prevent infinite loop.`);
        this.stop();
        return;
      }

      this.context.executionCount++;
      this.log(`🔧 Executing ${toolName} with params: ${JSON.stringify(params)}`);
      
      // Track this tool call for loop detection
      this.trackToolCall(toolName, params);
      
      // Add execution to context BEFORE running
      this.contextManager.update(`execution_${this.context.executionCount}`, {
        tool: toolName,
        params: params,
        timestamp: new Date().toISOString(),
        executionNumber: this.context.executionCount
      });
      
      const result = await this.mcpServer.callTool(toolName, params);
      
      if (result.isError) {
        const errorMsg = result.content[0]?.text || 'Unknown tool error';
        this.context.errors.push(`${toolName}: ${errorMsg}`);
        
        // Add error to context
        this.contextManager.update(`error_${this.context.executionCount}`, {
          tool: toolName,
          params: params,
          error: errorMsg,
          timestamp: new Date().toISOString()
        });
        
        this.log(`❌ Tool error: ${errorMsg}`);
      } else {
        const resultData = result.content[0]?.data || result.content[0]?.text;
        this.context.lastResults.set(toolName, resultData);
        
        // Add successful result to context
        this.contextManager.update(`last_${toolName}`, resultData);
        this.contextManager.update(`result_${this.context.executionCount}`, {
          tool: toolName,
          params: params,
          result: resultData,
          timestamp: new Date().toISOString(),
          success: true
        });
        
        this.log(`✅ ${toolName} result: ${JSON.stringify(resultData)}`);
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.context.errors.push(`${toolName}: ${errorMsg}`);
      
      // Add exception to context
      this.contextManager.update(`exception_${this.context.executionCount}`, {
        tool: toolName,
        params: params,
        exception: errorMsg,
        timestamp: new Date().toISOString()
      });
      
      this.log(`❌ Tool execution failed: ${errorMsg}`);
    }
  }

  private handleError(error: unknown): void {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    this.context.errors.push(errorMsg);
    this.log(`❌ Agent error: ${errorMsg}`);
    
    // If too many errors, stop the agent
    if (this.context.errors.length > 10) {
      this.log("🛑 Too many errors, stopping agent");
      this.stop();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private detectLoop(toolName: string, params: any): boolean {
    // Check if this exact tool call (name + params) has been repeated too many times recently
    const currentCall = { tool: toolName, params: JSON.stringify(params) };
    
    // Count how many times this exact call appears in recent history
    const recentMatches = this.recentToolCalls.filter(call => 
      call.tool === toolName && JSON.stringify(call.params) === JSON.stringify(params)
    );
    
    if (recentMatches.length >= this.loopDetectionThreshold) {
      return true;
    }
    
    // Also check for rapid repeated failures with the same tool
    const recentErrors = this.context.errors.slice(-5);
    const sameToolErrors = recentErrors.filter(error => error.includes(toolName));
    
    if (sameToolErrors.length >= 3) {
      this.log(`⚠️ Detected ${sameToolErrors.length} recent errors with ${toolName}`);
      return true;
    }
    
    return false;
  }
  
  private trackToolCall(toolName: string, params: any): void {
    // Add this call to recent history
    this.recentToolCalls.push({
      tool: toolName,
      params: params,
      timestamp: Date.now()
    });
    
    // Keep only the most recent calls
    if (this.recentToolCalls.length > this.maxRecentCalls) {
      this.recentToolCalls = this.recentToolCalls.slice(-this.maxRecentCalls);
    }
    
    // Also remove calls older than 2 minutes
    const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
    this.recentToolCalls = this.recentToolCalls.filter(call => call.timestamp > twoMinutesAgo);
  }

  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    this.onLog(logMessage);
    console.log(logMessage);
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      executionCount: this.context.executionCount,
      errorCount: this.context.errors.length,
      runtime: Math.round((Date.now() - this.context.startTime) / 1000),
      contextSize: this.contextManager.size(),
      recentToolCalls: this.recentToolCalls.length
    };
  }
}
