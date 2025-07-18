/**
 * Chat Session orchestrator following the Python implementation pattern
 * Manages the interaction between user, LLM, and tools
 */

import { ToolManager } from '../tools/ToolManager';
import { LLMClient, Message, LLMError } from '../llm/LLMClient';
import { getConfig } from '../config/Configuration';

export interface SessionContext {
  messages: Message[];
  executionCount: number;
  errors: string[];
  startTime: number;
  lastToolResults: Map<string, any>;
}

export interface SessionStats {
  isActive: boolean;
  executionCount: number;
  errorCount: number;
  runtime: number;
  messageCount: number;
  lastActivity: string;
}

/**
 * Chat Session class that orchestrates the interaction between user, LLM, and tools
 * Similar to the Python ChatSession class
 */
export class ChatSession {
  private isActive = false;
  private context: SessionContext;
  private onLog: (message: string) => void;
  private config = getConfig();

  constructor(
    private toolManager: ToolManager,
    private llmClient: LLMClient,
    onLog: (message: string) => void
  ) {
    this.onLog = onLog;
    this.context = {
      messages: [],
      executionCount: 0,
      errors: [],
      startTime: Date.now(),
      lastToolResults: new Map()
    };
  }

  /**
   * Start the chat session
   * Similar to Python's start method
   */
  async start(): Promise<void> {
    if (this.isActive) {
      this.log("Session is already active");
      return;
    }

    this.isActive = true;
    this.context.startTime = Date.now();
    this.context.executionCount = 0;
    this.context.errors = [];
    this.context.messages = [];

    this.log("🚀 Chat session starting...");

    try {
      // Build system prompt with available tools
      const systemPrompt = this.buildSystemPrompt();
      this.context.messages.push({
        role: 'system',
        content: systemPrompt
      });

      this.log("✅ Chat session initialized with system prompt");
      this.log(`🔧 Available tools: ${this.toolManager.getToolCount()}`);

    } catch (error) {
      this.handleError(error);
      this.isActive = false;
    }
  }

  /**
   * Process a user message and get response
   * Similar to Python's message processing
   */
  async processMessage(userMessage: string): Promise<string> {
    if (!this.isActive) {
      throw new Error("Session is not active. Call start() first.");
    }

    try {
      this.log(`👤 User: ${userMessage}`);
      
      // Add user message to context
      this.context.messages.push({
        role: 'user',
        content: userMessage
      });

      // Get LLM response
      const llmResponse = await this.llmClient.getResponse(this.context.messages);
      this.log(`🤖 LLM Response: ${llmResponse.content}`);

      // Process the response (check for tool calls)
      const result = await this.processLLMResponse(llmResponse.content);

      // Add final response to context
      this.context.messages.push({
        role: 'assistant',
        content: result
      });

      // Keep message history manageable
      this.trimMessageHistory();

      return result;

    } catch (error) {
      this.handleError(error);
      const errorMessage = `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`;
      
      this.context.messages.push({
        role: 'assistant',
        content: errorMessage
      });

      return errorMessage;
    }
  }

  /**
   * Process LLM response and execute tools if needed
   * Similar to Python's process_llm_response method
   */
  private async processLLMResponse(llmResponse: string): Promise<string> {
    try {
      // Check if this is a tool call
      const toolCall = this.llmClient.parseToolCall(llmResponse);
      
      if (toolCall.isToolCall && toolCall.tool && toolCall.arguments) {
        this.log(`🔧 Tool call detected: ${toolCall.tool}`);
        this.log(`📝 Arguments: ${JSON.stringify(toolCall.arguments)}`);

        // Execute the tool
        const toolResult = await this.toolManager.executeTool(toolCall.tool, toolCall.arguments);
        
        if (toolResult.success) {
          this.log(`✅ Tool execution successful`);
          this.log(`📊 Tool result: ${JSON.stringify(toolResult.data, null, 2)}`);
          this.context.lastToolResults.set(toolCall.tool, toolResult.data);
          
          // Add tool result to conversation and get natural response
          this.context.messages.push({
            role: 'assistant',
            content: llmResponse
          });
          
          this.context.messages.push({
            role: 'system',
            content: `Tool execution result: ${JSON.stringify(toolResult.data)}

Based on this tool result, determine if you need to continue with more actions to complete the user's request, or if you should provide a final conversational response.

If you need to continue with more actions (like more calculations, storing data, etc.), respond with ONLY the next tool call in JSON format.
If the task is complete, provide a natural conversational response summarizing what you accomplished.
If you find yourself getting the same error message from the tool use 3 times in a row, report back details of this result with a final conversational response.`
          });

          // Get next response (could be another tool call or final response)
          const nextResponse = await this.llmClient.getResponse(this.context.messages, {
            responseFormat: undefined // Allow both JSON tools and natural responses
          });
          this.log(`🔄 Next response: ${nextResponse.content}`);
          
          // Check if the next response is another tool call
          const nextToolCall = this.llmClient.parseToolCall(nextResponse.content);
          if (nextToolCall.isToolCall) {
            // Recursively process the next tool call
            this.log(`🔁 Continuing with next tool call...`);
            return await this.processLLMResponse(nextResponse.content);
          } else {
            // Final conversational response
            return nextResponse.content;
          }
        } else {
          this.log(`❌ Tool execution failed: ${toolResult.error}`);
          return `I tried to use the ${toolCall.tool} tool, but it failed: ${toolResult.error}`;
        }
      }

      // Not a tool call, return the response directly
      return llmResponse;

    } catch (error) {
      this.log(`❌ Error processing LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return llmResponse; // Fallback to original response
    }
  }

  /**
   * Build system prompt with tool information
   * Similar to Python's system message building
   */
  private buildSystemPrompt(): string {
    const toolsDescription = this.toolManager.formatAllToolsForLLM();
    
    return this.llmClient.buildSystemPrompt(toolsDescription);
  }

  /**
   * Stop the chat session
   */
  stop(): void {
    if (!this.isActive) {
      this.log("Session is not active");
      return;
    }

    this.isActive = false;
    this.log("🛑 Chat session stopped");
  }

  /**
   * Handle errors with logging and context updates
   */
  private handleError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.context.errors.push(errorMessage);
    this.log(`❌ Session error: ${errorMessage}`);
    
    // Stop session if too many errors
    const maxErrors = this.config.agentConfig.maxErrors;
    if (this.context.errors.length > maxErrors) {
      this.log(`🛑 Too many errors (${this.context.errors.length}), stopping session`);
      this.stop();
    }
  }

  /**
   * Trim message history to keep it manageable
   */
  private trimMessageHistory(): void {
    const maxMessages = 20; // Keep last 20 messages
    
    if (this.context.messages.length > maxMessages) {
      // Keep system message and recent messages
      const systemMessage = this.context.messages[0];
      const recentMessages = this.context.messages.slice(-maxMessages + 1);
      this.context.messages = [systemMessage, ...recentMessages];
      
      this.log(`📝 Trimmed message history to ${this.context.messages.length} messages`);
    }
  }

  /**
   * Log message with timestamp
   */
  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    this.onLog(logMessage);
    console.log(logMessage);
  }

  /**
   * Get session statistics
   */
  getStats(): SessionStats {
    return {
      isActive: this.isActive,
      executionCount: this.context.executionCount,
      errorCount: this.context.errors.length,
      runtime: Math.round((Date.now() - this.context.startTime) / 1000),
      messageCount: this.context.messages.length,
      lastActivity: new Date().toISOString()
    };
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.isActive;
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): Message[] {
    return [...this.context.messages];
  }

  /**
   * Clear conversation history (keep system message)
   */
  clearHistory(): void {
    const systemMessage = this.context.messages.find(m => m.role === 'system');
    this.context.messages = systemMessage ? [systemMessage] : [];
    this.context.lastToolResults.clear();
    this.log("🗑️ Conversation history cleared");
  }

  /**
   * Get recent errors
   */
  getRecentErrors(): string[] {
    return [...this.context.errors.slice(-10)]; // Last 10 errors
  }

  /**
   * Get last tool results
   */
  getLastToolResults(): Map<string, any> {
    return new Map(this.context.lastToolResults);
  }

  /**
   * Add a custom message to the conversation
   */
  addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    this.context.messages.push({ role, content });
    this.log(`📝 Added ${role} message: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
  }

  /**
   * Update system prompt (useful for dynamic tool changes)
   */
  updateSystemPrompt(): void {
    const systemPrompt = this.buildSystemPrompt();
    
    // Replace existing system message
    const systemMessageIndex = this.context.messages.findIndex(m => m.role === 'system');
    if (systemMessageIndex >= 0) {
      this.context.messages[systemMessageIndex].content = systemPrompt;
    } else {
      this.context.messages.unshift({
        role: 'system',
        content: systemPrompt
      });
    }
    
    this.log("🔄 System prompt updated with current tools");
  }

  /**
   * Get session context summary
   */
  getContextSummary(): {
    messageCount: number;
    toolCount: number;
    errorCount: number;
    runtime: number;
    lastToolResults: Record<string, any>;
  } {
    return {
      messageCount: this.context.messages.length,
      toolCount: this.toolManager.getToolCount(),
      errorCount: this.context.errors.length,
      runtime: Math.round((Date.now() - this.context.startTime) / 1000),
      lastToolResults: Object.fromEntries(this.context.lastToolResults)
    };
  }
}
