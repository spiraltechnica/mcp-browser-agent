/**
 * Chat Session orchestrator following the Python implementation pattern
 * Manages the interaction between user, LLM, and tools
 */

import { ToolManager } from '../tools/ToolManager';
import { LLMClient, Message, ToolCall } from '../llm/LLMClient';
import { getConfig } from '../config/Configuration';
import { getMCPTransport } from '../mcp/MCPTransport';
import { MCPMethods } from '../mcp/MCPProtocol';
import { getDebugEventManager } from '../debug/DebugEventManager';

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
      // Initialize MCP connection
      const transport = getMCPTransport();
      await transport.sendRequest(MCPMethods.INITIALIZE, {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {}, sampling: {} },
        clientInfo: {
          name: "mcp-browser-client",
          version: "1.0.0",
          capabilities: { tools: {}, sampling: {} }
        }
      });

      this.log("✅ MCP connection initialized");

      // Build system prompt with available tools
      const systemPrompt = await this.buildSystemPrompt();
      this.context.messages.push({
        role: 'system',
        content: systemPrompt
      });

      this.log("✅ Chat session initialized with system prompt");

      // Get tool count via JSON-RPC
      const toolsResponse = await transport.sendRequest(MCPMethods.TOOLS_LIST);
      this.log(`🔧 Available tools: ${toolsResponse.tools.length}`);

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

    const debugManager = getDebugEventManager();
    
    // Start a new conversation flow in debug manager
    const flowId = debugManager.startConversation(userMessage);

    try {
      this.log(`👤 User: ${userMessage}`);
      
      // Add user message to context
      this.context.messages.push({
        role: 'user',
        content: userMessage
      });

      // Get ALL tools for MCP standard format - LLM decides which to use
      const tools = this.toolManager.getToolsForMCP();
      
      // Add LLM request debug event
      const requestStartTime = Date.now();
      const requestPayload = {
        messages: this.context.messages,
        tools: tools.length > 0 ? tools : undefined,
        model: this.config.llmConfig.model,
        temperature: this.config.llmConfig.temperature,
        max_tokens: this.config.llmConfig.maxTokens
      };
      const requestEventId = debugManager.addLLMRequest(requestPayload, JSON.stringify(requestPayload, null, 2));
      
      const llmResponse = await this.llmClient.getResponse(this.context.messages, {
        tools: tools.length > 0 ? tools : undefined
      });
      
      // Add LLM response debug event with raw data
      const requestDuration = Date.now() - requestStartTime;
      debugManager.addLLMResponse(
        llmResponse, 
        requestEventId, 
        requestDuration, 
        llmResponse.rawResponseBody
      );
      
      this.log(`🤖 LLM Response: ${llmResponse.content || 'Tool calls detected'}`);
      if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
        this.log(`🔧 Tool calls: ${llmResponse.tool_calls.length}`);
      }

      // Process the response (handle both content and tool calls)
      const result = await this.processLLMResponseMCP(llmResponse);

      // Add final response to context
      this.context.messages.push({
        role: 'assistant',
        content: result
      });

      // Complete the conversation flow in debug manager
      debugManager.completeConversation(result);

      // Keep message history manageable
      this.trimMessageHistory();

      return result;

    } catch (error) {
      // Add error to debug manager
      debugManager.addError(error instanceof Error ? error : new Error(String(error)));
      
      this.handleError(error);
      const errorMessage = `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`;
      
      this.context.messages.push({
        role: 'assistant',
        content: errorMessage
      });

      // Complete the conversation flow with error
      debugManager.completeConversation(errorMessage);

      return errorMessage;
    }
  }

  /**
   * Process LLM response using MCP standard format
   */
  private async processLLMResponseMCP(llmResponse: { content: string | null; tool_calls?: ToolCall[] }): Promise<string> {
    const debugManager = getDebugEventManager();
    
    try {
      // If there are tool calls, execute them
      if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
        this.log(`🔧 Processing ${llmResponse.tool_calls.length} tool calls`);
        
        // Add assistant message with tool calls to conversation
        this.context.messages.push({
          role: 'assistant',
          content: llmResponse.content,
          tool_calls: llmResponse.tool_calls
        });

        // Execute each tool call via JSON-RPC and add tool messages
        const transport = getMCPTransport();
        
        for (const toolCall of llmResponse.tool_calls) {
          this.log(`🔧 Executing tool via MCP: ${toolCall.function.name}`);
          
          // Add tool call parsed event
          debugManager.addToolCallParsed(toolCall);
          
          let arguments_: any;
          let executionStartTime = Date.now(); // Declare at the start of the loop
          
          try {
            arguments_ = JSON.parse(toolCall.function.arguments);
          } catch (error) {
            this.log(`❌ Failed to parse tool arguments: ${toolCall.function.arguments}`);
            arguments_ = {};
            debugManager.addError(new Error(`Failed to parse tool arguments: ${toolCall.function.arguments}`));
          }

          try {
            // Prepare MCP request
            const mcpRequest = {
              name: toolCall.function.name,
              arguments: arguments_
            };
            
            // Add tool execution start event
            executionStartTime = Date.now(); // Reset timing for actual execution
            const executionEventId = debugManager.addToolExecution(
              toolCall.function.name, 
              mcpRequest, 
              toolCall.id
            );
            
            // Call tool via JSON-RPC
            const mcpResult = await transport.sendRequest(MCPMethods.TOOLS_CALL, mcpRequest);

            // Calculate execution duration
            const executionDuration = Date.now() - executionStartTime;

            // Log the full MCP response for debugging
            this.log(`🔍 Full MCP response: ${JSON.stringify(mcpResult, null, 2)}`);

            // Extract result from MCP response format
            let resultContent: string;
            let success = !mcpResult.isError;
            
            if (mcpResult.content && mcpResult.content.length > 0) {
              // Try to get the most detailed content available
              const contentItem = mcpResult.content[0];
              
              if (contentItem.text) {
                resultContent = contentItem.text;
              } else if (contentItem.data) {
                resultContent = JSON.stringify(contentItem.data, null, 2);
              } else {
                resultContent = JSON.stringify(contentItem, null, 2);
              }
              
              // Store successful results
              if (success && contentItem.data) {
                this.context.lastToolResults.set(toolCall.function.name, contentItem.data);
              }
            } else {
              // No content array, check if there's any other data in the response
              if (mcpResult.isError) {
                resultContent = `Tool execution failed: ${JSON.stringify(mcpResult, null, 2)}`;
                success = false;
              } else {
                resultContent = `Tool executed but returned no content: ${JSON.stringify(mcpResult, null, 2)}`;
              }
            }

            // Add tool result event
            debugManager.addToolResult(
              toolCall.function.name,
              success ? (mcpResult.content?.[0]?.data || resultContent) : resultContent,
              success,
              executionEventId,
              executionDuration
            );

            // Create tool message
            const toolMessage = this.llmClient.createToolMessage(
              toolCall.id,
              toolCall.function.name,
              resultContent
            );
            
            this.context.messages.push(toolMessage);
            
            if (success) {
              this.log(`✅ MCP tool execution successful: ${toolCall.function.name}`);
              this.log(`📋 Tool result preview: ${resultContent.substring(0, 300)}${resultContent.length > 300 ? '...' : ''}`);
            } else {
              this.log(`❌ MCP tool execution failed: ${toolCall.function.name}`);
              this.log(`🔍 Full error details: ${resultContent}`);
              
              // Add error to session context for tracking
              this.context.errors.push(`Tool ${toolCall.function.name}: ${resultContent}`);
            }

          } catch (error) {
            const executionDuration = Date.now() - executionStartTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            this.log(`❌ MCP tool call failed: ${toolCall.function.name} - ${errorMessage}`);
            
            // Add tool result error event
            debugManager.addToolResult(
              toolCall.function.name,
              errorMessage,
              false,
              undefined,
              executionDuration
            );
            
            // Add general error event
            debugManager.addError(error instanceof Error ? error : new Error(errorMessage));
            
            // Create error tool message
            const toolMessage = this.llmClient.createToolMessage(
              toolCall.id,
              toolCall.function.name,
              `Error: ${errorMessage}`
            );
            
            this.context.messages.push(toolMessage);
          }
        }

        // Get final response from LLM after tool execution
        const tools = this.toolManager.getToolsForMCP();
        
        // Add LLM request for follow-up
        const followUpStartTime = Date.now();
        const followUpRequestPayload = {
          messages: this.context.messages,
          tools: tools.length > 0 ? tools : undefined,
          model: this.config.llmConfig.model,
          temperature: this.config.llmConfig.temperature,
          max_tokens: this.config.llmConfig.maxTokens
        };
        const followUpRequestEventId = debugManager.addLLMRequest(followUpRequestPayload, JSON.stringify(followUpRequestPayload, null, 2));
        
        const finalResponse = await this.llmClient.getResponse(this.context.messages, {
          tools: tools.length > 0 ? tools : undefined
        });

        // Add LLM response for follow-up
        const followUpDuration = Date.now() - followUpStartTime;
        debugManager.addLLMResponse(finalResponse, followUpRequestEventId, followUpDuration, finalResponse.rawResponseBody);

        this.log(`🔄 Final response: ${finalResponse.content || 'Additional tool calls detected'}`);

        // Check if there are more tool calls
        if (finalResponse.tool_calls && finalResponse.tool_calls.length > 0) {
          // Recursively process more tool calls
          return await this.processLLMResponseMCP(finalResponse);
        } else {
          // Return final content
          return finalResponse.content || 'Task completed successfully.';
        }
      }

      // No tool calls, return content directly
      return llmResponse.content || 'No response content available.';

    } catch (error) {
      this.log(`❌ Error processing MCP response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      debugManager.addError(error instanceof Error ? error : new Error('Error processing MCP response'));
      return llmResponse.content || 'An error occurred while processing the response.';
    }
  }


  /**
   * Build system prompt with tool information
   * Similar to Python's system message building
   */
  private buildSystemPrompt(): string {
    // Use MCP standard format - tools are provided in the tools array, not in system prompt
    return this.toolManager.buildMCPSystemPrompt();
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
