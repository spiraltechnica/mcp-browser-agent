/**
 * Tool Manager for centralized tool registration and management
 * Similar to the Python implementation's tool management approach
 */

import { Tool, ToolResult } from './Tool';
import { getConfig } from '../config/Configuration';
import { MCPTool } from '../llm/LLMClient';

export interface ToolInfo {
  name: string;
  description: string;
  inputSchema: any;
  title?: string;
}

/**
 * Centralized tool management system
 * Handles tool registration, discovery, and execution
 */
export class ToolManager {
  private tools: Map<string, Tool> = new Map();
  private listeners: Set<() => void> = new Set();
  private executionHistory: Array<{
    toolName: string;
    parameters: any;
    result: ToolResult;
    timestamp: string;
  }> = [];

  constructor() {
    // Initialize execution history
    this.executionHistory = [];
  }

  /**
   * Register a tool
   */
  registerTool(tool: Tool): void {
    // Validate tool before registration
    const validation = tool.validate();
    if (!validation.valid) {
      throw new Error(`Cannot register invalid tool '${tool.name}': ${validation.errors.join(', ')}`);
    }

    // Check for name conflicts
    if (this.tools.has(tool.name)) {
      console.warn(`Tool '${tool.name}' is being replaced`);
    }

    this.tools.set(tool.name, tool);
    this.notifyListeners();
    
    console.log(`✅ Tool registered: ${tool.name}`);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean {
    const deleted = this.tools.delete(name);
    if (deleted) {
      this.notifyListeners();
      console.log(`🗑️ Tool unregistered: ${name}`);
    }
    return deleted;
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool information for MCP protocol
   */
  getToolsInfo(): ToolInfo[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      title: tool.title
    }));
  }


  /**
   * Execute a tool with comprehensive error handling and logging
   */
  async executeTool(name: string, parameters: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      const error = `Tool '${name}' not found. Available tools: ${Array.from(this.tools.keys()).join(', ')}`;
      const result: ToolResult = {
        success: false,
        error,
        metadata: {
          toolName: name,
          executedAt: new Date().toISOString(),
          parameters
        }
      };
      
      this.recordExecution(name, parameters, result);
      return result;
    }

    try {
      console.log(`🔧 Executing tool: ${name}`, parameters);
      
      const result = await tool.execute(parameters);
      
      // Record execution in history
      this.recordExecution(name, parameters, result);
      
      if (result.success) {
        console.log(`✅ Tool execution successful: ${name}`, result.data);
      } else {
        console.warn(`❌ Tool execution failed: ${name}`, result.error);
      }
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const result: ToolResult = {
        success: false,
        error: `Tool execution exception: ${errorMessage}`,
        metadata: {
          toolName: name,
          executedAt: new Date().toISOString(),
          parameters,
          exception: errorMessage
        }
      };
      
      this.recordExecution(name, parameters, result);
      console.error(`💥 Tool execution exception: ${name}`, error);
      
      return result;
    }
  }

  /**
   * Record tool execution in history
   */
  private recordExecution(toolName: string, parameters: any, result: ToolResult): void {
    const config = getConfig();
    
    this.executionHistory.push({
      toolName,
      parameters,
      result,
      timestamp: new Date().toISOString()
    });

    // Keep history within reasonable limits
    const maxHistory = config.loggingConfig.maxLogEntries || 1000;
    if (this.executionHistory.length > maxHistory) {
      this.executionHistory = this.executionHistory.slice(-maxHistory);
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): Array<{
    toolName: string;
    parameters: any;
    result: ToolResult;
    timestamp: string;
  }> {
    return [...this.executionHistory];
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    toolUsageCounts: Record<string, number>;
    recentErrors: string[];
  } {
    const totalExecutions = this.executionHistory.length;
    const successfulExecutions = this.executionHistory.filter(h => h.result.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    
    const toolUsageCounts: Record<string, number> = {};
    const recentErrors: string[] = [];
    
    for (const execution of this.executionHistory) {
      toolUsageCounts[execution.toolName] = (toolUsageCounts[execution.toolName] || 0) + 1;
      
      if (!execution.result.success && execution.result.error) {
        recentErrors.push(`${execution.toolName}: ${execution.result.error}`);
      }
    }
    
    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      toolUsageCounts,
      recentErrors: recentErrors.slice(-10) // Last 10 errors
    };
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
    console.log('🗑️ Tool execution history cleared');
  }

  /**
   * Register a listener for tool changes
   */
  onToolsChanged(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of tool changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in tool change listener:', error);
      }
    });
  }

  /**
   * Get tool count
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * Check if any tools are registered
   */
  hasTools(): boolean {
    return this.tools.size > 0;
  }

  /**
   * Validate all registered tools
   */
  validateAllTools(): { valid: boolean; errors: Record<string, string[]> } {
    const errors: Record<string, string[]> = {};
    let allValid = true;

    for (const [name, tool] of this.tools) {
      const validation = tool.validate();
      if (!validation.valid) {
        errors[name] = validation.errors;
        allValid = false;
      }
    }

    return { valid: allValid, errors };
  }

  /**
   * Get tools by category or filter
   */
  getToolsByFilter(filter: (tool: Tool) => boolean): Tool[] {
    return Array.from(this.tools.values()).filter(filter);
  }

  /**
   * Search tools by name or description
   */
  searchTools(query: string): Tool[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.tools.values()).filter(tool => 
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery) ||
      (tool.title && tool.title.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Convert tools to MCP standard format for OpenAI function calling
   */
  getToolsForMCP(): MCPTool[] {
    return Array.from(this.tools.values()).map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
  }

  /**
   * Get simplified system prompt for MCP standard format
   * (Tools are provided in the tools array, not in system prompt)
   */
  buildMCPSystemPrompt(): string {
    return `You are a helpful AI assistant that can use tools when needed.

CRITICAL TOOL USAGE RULES:
- When a user asks "what tools do you have" or similar questions about your capabilities, you MUST use the list_tools function to get the actual available tools
- When a user asks you to DO something (calculate, store data, query information, etc.), you MUST use the appropriate tool
- Use the function calling capability provided by the system - tools are available in the tools array
- Wait for tool results before continuing your response
- After using tools, provide natural conversational responses about what you accomplished
- If asked to find something and you can't find it after 4 attempts using different tool parameters, then ask the user for help.



NEVER make up or guess what tools you have - always use the list_tools function to get the real list.

For simple greetings or general conversation that doesn't require tools or tool information, respond naturally.`;
  }
}

/**
 * Global tool manager instance
 */
let globalToolManager: ToolManager | null = null;

/**
 * Get the global tool manager instance
 */
export function getToolManager(): ToolManager {
  if (!globalToolManager) {
    globalToolManager = new ToolManager();
  }
  return globalToolManager;
}

/**
 * Reset the global tool manager (useful for testing)
 */
export function resetToolManager(): void {
  globalToolManager = null;
}
