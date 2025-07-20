/**
 * Application Host - Main application orchestrator
 * Uses MCP infrastructure but handles application-specific logic
 * Coordinates conversation management, LLM integration, and MCP context
 */

import { getMCPHost, MCPHost, MCPContext, ToolResult, ServerConfig } from '../mcp-core/MCPHost';
import { getMCPServer } from '../mcp-core/MCPServer';
import { getLLMClient, LLMClient } from '../llm/LLMClient';
import { ConversationManager, Message } from './ConversationManager';
import { getDebugEventManager } from '../debug/DebugEventManager';
import { getConfig } from './HostConfiguration';

export interface ApplicationContext {
  mcpContext: MCPContext;
  conversationContext: any;
  userPreferences: Record<string, any>;
  sessionInfo: {
    startTime: number;
    lastActivity: number;
    messageCount: number;
  };
}

export interface ApplicationStats {
  isRunning: boolean;
  executionCount: number;
  errorCount: number;
  runtime: number;
  contextSize: number;
  mcpServerCount: number;
  conversationStats: any;
}

/**
 * Main application orchestrator that uses MCP infrastructure
 * Handles conversation management, LLM coordination, and context merging
 */
export class ApplicationHost {
  private mcpHost: MCPHost;
  private llmClient: LLMClient;
  private conversationManager: ConversationManager;
  private debugManager = getDebugEventManager();
  private config = getConfig();
  private isActive = false;
  private startTime = 0;
  private onLog: (message: string) => void;
  private errors: string[] = [];

  constructor(onLog: (message: string) => void) {
    this.onLog = onLog;
    this.mcpHost = getMCPHost();
    this.llmClient = getLLMClient();
    this.conversationManager = new ConversationManager();
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    if (this.isActive) {
      this.log("Application is already running");
      return;
    }

    this.startTime = Date.now();
    this.log("🚀 Starting MCP Browser Agent Application...");

    try {
      // Initialize MCP infrastructure
      await this.initializeMCPInfrastructure();

      // Set up conversation with system prompt
      await this.initializeConversation();

      this.isActive = true;
      this.log("✅ Application initialized successfully");

      // Log system summary
      await this.logSystemSummary();

    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Process a user message through the complete application flow
   */
  async processMessage(userMessage: string): Promise<string> {
    if (!this.isActive) {
      throw new Error("Application is not active. Call initialize() first.");
    }

    const flowId = this.debugManager.startConversation(userMessage);

    try {
      this.log(`👤 User: ${userMessage}`);

      // Add user message to conversation
      this.conversationManager.addUserMessage(userMessage);

      // Get MCP context (tools, capabilities, server status)
      const mcpContext = await this.mcpHost.getMCPContext();

      // Get application context (conversation, preferences, etc.)
      const appContext = this.getApplicationContext();

      // Merge contexts for LLM
      const fullContext = this.mergeContexts(mcpContext, appContext);

      // Get LLM response with tools
      const llmResponse = await this.getLLMResponse(fullContext);

      // Process tool calls if any
      if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
        const finalResponse = await this.processToolCalls(llmResponse);
        
        this.conversationManager.addAssistantMessage(finalResponse);
        this.debugManager.completeConversation(finalResponse);
        
        return finalResponse;
      }

      // No tool calls, return direct response
      const response = llmResponse.content || 'I understand, but I don\'t have a specific response.';
      this.conversationManager.addAssistantMessage(response);
      this.debugManager.completeConversation(response);

      return response;

    } catch (error) {
      this.debugManager.addError(error instanceof Error ? error : new Error(String(error)));
      this.handleError(error);
      
      const errorMessage = `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`;
      this.conversationManager.addAssistantMessage(errorMessage);
      this.debugManager.completeConversation(errorMessage);
      
      return errorMessage;
    }
  }

  /**
   * Stop the application
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      this.log("Application is not running");
      return;
    }

    this.log("🛑 Stopping MCP Browser Agent Application...");
    
    try {
      // Clean up MCP infrastructure
      await this.mcpHost.cleanup();
      
      this.isActive = false;
      this.log("✅ Application stopped successfully");
      
    } catch (error) {
      this.log(`⚠️ Warning during application stop: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get application statistics
   */
  getStats(): ApplicationStats {
    const runtime = Math.round((Date.now() - this.startTime) / 1000);
    const conversationStats = this.conversationManager.getStats();
    
    return {
      isRunning: this.isActive,
      executionCount: conversationStats.totalMessages,
      errorCount: this.errors.length,
      runtime,
      contextSize: conversationStats.totalMessages,
      mcpServerCount: this.mcpHost.getServerCount(),
      conversationStats
    };
  }

  /**
   * Check if application is active
   */
  isApplicationActive(): boolean {
    return this.isActive;
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): Message[] {
    return this.conversationManager.getMessages();
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationManager.clear();
    this.log("🗑️ Conversation history cleared");
  }

  /**
   * Get recent errors
   */
  getRecentErrors(): string[] {
    return [...this.errors.slice(-10)];
  }

  /**
   * Get system context summary
   */
  getSystemContext(): {
    application: ApplicationStats;
    mcp: any;
    conversation: any;
    config: any;
  } {
    return {
      application: this.getStats(),
      mcp: this.mcpHost.healthCheck(),
      conversation: this.conversationManager.getContext(),
      config: this.config.getSummary()
    };
  }

  /**
   * Private helper methods
   */

  /**
   * Initialize MCP infrastructure
   */
  private async initializeMCPInfrastructure(): Promise<void> {
    this.log("🔧 Initializing MCP infrastructure...");

    // Initialize the MCP server with tools
    const mcpServer = getMCPServer();
    await mcpServer.initialize();

    // Add the browser tools server to MCP host
    const serverConfig: ServerConfig = {
      name: "browser-tools",
      version: "1.0.0",
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true }
      }
    };

    await this.mcpHost.addServer(serverConfig);

    this.log(`✅ MCP infrastructure initialized with ${this.mcpHost.getServerCount()} servers`);
  }

  /**
   * Initialize conversation with system prompt
   */
  private async initializeConversation(): Promise<void> {
    this.log("💬 Initializing conversation...");

    // Get system prompt from MCP tools
    const mcpContext = await this.mcpHost.getMCPContext();
    const systemPrompt = this.buildSystemPrompt(mcpContext);
    
    this.conversationManager.addSystemMessage(systemPrompt);
    
    this.log("✅ Conversation initialized with system prompt");
  }

  /**
   * Build system prompt with MCP context
   */
  private buildSystemPrompt(mcpContext: MCPContext): string {
    const toolCount = mcpContext.availableTools.length;
    const serverCount = mcpContext.serverStatus.length;

    return `You are a helpful AI assistant that can use tools when needed. You are embedded in a web page.

CRITICAL TOOL USAGE RULES:
- When a user asks "what tools do you have" or similar questions about your capabilities, you MUST use the list_tools function to get the actual available tools
- When a user asks you to DO something (calculate, store data, query information, etc.), you MUST use the appropriate tool
- Use the function calling capability provided by the system - tools are available in the tools array
- Wait for tool results before continuing your response
- After using tools, provide natural conversational responses about what you accomplished
- If asked to find something and you can't find it after 4 attempts using different tool parameters, then ask the user for help.

NEVER make up or guess what tools you have - always use the list_tools function to get the real list.

For simple greetings or general conversation that doesn't require tools or tool information, respond naturally.

System Status:
- MCP Servers: ${serverCount}
- Available Tools: ${toolCount}
- Protocol: MCP 2025-06-18`;
  }

  /**
   * Get application context
   */
  private getApplicationContext(): any {
    return {
      conversation: this.conversationManager.getContext(),
      userPreferences: {}, // Future: user preferences
      sessionInfo: {
        startTime: this.startTime,
        lastActivity: Date.now(),
        messageCount: this.conversationManager.getMessageCount()
      }
    };
  }

  /**
   * Merge MCP and application contexts
   */
  private mergeContexts(mcpContext: MCPContext, appContext: any): ApplicationContext {
    return {
      mcpContext,
      conversationContext: appContext.conversation,
      userPreferences: appContext.userPreferences,
      sessionInfo: appContext.sessionInfo
    };
  }

  /**
   * Get LLM response with tools
   */
  private async getLLMResponse(context: ApplicationContext): Promise<any> {
    const messages = this.conversationManager.getMessagesForLLM();
    const tools = context.mcpContext.availableTools.map(tool => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));

    // 🐛 DEBUG: Log tools being sent to LLM
    this.log(`🔧 DEBUG: Available tools from MCP context: ${context.mcpContext.availableTools.length}`);
    this.log(`🔧 DEBUG: Tool names: [${context.mcpContext.availableTools.map(t => t.name).join(', ')}]`);
    this.log(`🔧 DEBUG: Formatted tools for LLM: ${tools.length}`);
    this.log(`🔧 DEBUG: Will send tools to LLM: ${tools.length > 0 ? 'YES' : 'NO'}`);

    // Add LLM request debug event
    const requestStartTime = Date.now();
    const requestPayload = {
      messages,
      tools: tools.length > 0 ? tools : undefined,
      model: this.config.llmConfig.model,
      temperature: this.config.llmConfig.temperature,
      max_tokens: this.config.llmConfig.maxTokens
    };
    
    const requestEventId = this.debugManager.addLLMRequest(
      requestPayload, 
      JSON.stringify(requestPayload, null, 2)
    );

    const llmResponse = await this.llmClient.getResponse(messages, {
      tools: tools.length > 0 ? tools : undefined
    });

    // Add LLM response debug event
    const requestDuration = Date.now() - requestStartTime;
    this.debugManager.addLLMResponse(
      llmResponse,
      requestEventId,
      requestDuration,
      llmResponse.rawResponseBody
    );

    this.log(`🤖 LLM Response: ${llmResponse.content || 'Tool calls detected'}`);
    if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
      this.log(`🔧 Tool calls: ${llmResponse.tool_calls.length}`);
    }

    return llmResponse;
  }

  /**
   * Process tool calls and get final response
   */
  private async processToolCalls(llmResponse: any): Promise<string> {
    // 🐛 DEBUG: Add detailed logging for tool calls
    this.log(`🔧 DEBUG: llmResponse type: ${typeof llmResponse}`);
    this.log(`🔧 DEBUG: llmResponse.tool_calls type: ${typeof llmResponse.tool_calls}`);
    this.log(`🔧 DEBUG: llmResponse.tool_calls is null: ${llmResponse.tool_calls === null}`);
    this.log(`🔧 DEBUG: llmResponse.tool_calls is array: ${Array.isArray(llmResponse.tool_calls)}`);
    
    if (!llmResponse.tool_calls || !Array.isArray(llmResponse.tool_calls)) {
      this.log(`❌ ERROR: Invalid tool_calls structure`);
      return 'Error: Invalid tool calls received from LLM';
    }

    this.log(`🔧 Processing ${llmResponse.tool_calls.length} tool calls`);

    // Add assistant message with tool calls
    this.conversationManager.addAssistantMessage(
      llmResponse.content,
      llmResponse.tool_calls
    );

    // Execute each tool call
    this.log(`🔧 DEBUG: About to iterate through tool_calls...`);
    this.log(`🔧 DEBUG: tool_calls content: ${JSON.stringify(llmResponse.tool_calls)}`);
    
    for (let i = 0; i < llmResponse.tool_calls.length; i++) {
      const toolCall = llmResponse.tool_calls[i];
      this.log(`🔧 DEBUG: Processing tool call index ${i}: ${toolCall ? 'exists' : 'is null/undefined'}`);
      
      let args: any = {};
      
      try {
        this.log(`🔧 DEBUG: Processing tool call: ${JSON.stringify(toolCall)}`);
        
        if (!toolCall || !toolCall.function) {
          this.log(`❌ ERROR: Invalid tool call structure`);
          continue;
        }
        
        this.log(`🔧 Executing tool: ${toolCall.function.name}`);
        this.log(`🔧 DEBUG: Tool call ID: ${toolCall.id}`);
        this.log(`🔧 DEBUG: Tool arguments: ${toolCall.function.arguments}`);

        // Add tool call parsed event
        this.debugManager.addToolCallParsed(toolCall);

        try {
          this.log(`🔧 DEBUG: Parsing arguments...`);
          args = JSON.parse(toolCall.function.arguments);
          this.log(`🔧 DEBUG: Arguments parsed successfully: ${JSON.stringify(args)}`);
        } catch (error) {
          this.log(`❌ Failed to parse tool arguments: ${toolCall.function.arguments}`);
          args = {};
          this.debugManager.addError(new Error(`Failed to parse tool arguments: ${toolCall.function.arguments}`));
        }
      } catch (error) {
        this.log(`❌ ERROR in tool call processing: ${error instanceof Error ? error.message : 'Unknown error'}`);
        this.log(`❌ ERROR stack: ${error instanceof Error ? error.stack : 'No stack'}`);
        continue;
      }

      const executionStartTime = Date.now();
      const executionEventId = this.debugManager.addToolExecution(
        toolCall.function.name,
        { name: toolCall.function.name, arguments: args },
        toolCall.id
      );

      try {
        // Execute tool via MCP
        const result: ToolResult = await this.mcpHost.executeTool(toolCall.function.name, args);
        const executionDuration = Date.now() - executionStartTime;

        // Format result for conversation
        let resultContent: string;
        if (result.success && result.data) {
          resultContent = JSON.stringify(result.data, null, 2);
        } else if (result.content && Array.isArray(result.content) && result.content.length > 0) {
          const firstContent = result.content[0];
          resultContent = firstContent.text || JSON.stringify(firstContent.data, null, 2);
        } else {
          resultContent = result.error || 'Tool executed but returned no content';
        }

        // Add tool result to conversation
        this.conversationManager.addToolResult(
          toolCall.id,
          toolCall.function.name,
          resultContent
        );

        // Add debug events
        this.debugManager.addToolResult(
          toolCall.function.name,
          result.success ? (result.data || resultContent) : resultContent,
          result.success,
          executionEventId,
          executionDuration
        );

        this.log(`✅ Tool execution successful: ${toolCall.function.name}`);

      } catch (error) {
        const executionDuration = Date.now() - executionStartTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        this.log(`❌ Tool execution failed: ${toolCall.function.name} - ${errorMessage}`);

        // Add error tool result
        this.conversationManager.addToolResult(
          toolCall.id,
          toolCall.function.name,
          `Error: ${errorMessage}`
        );

        // Add debug events
        this.debugManager.addToolResult(
          toolCall.function.name,
          errorMessage,
          false,
          executionEventId,
          executionDuration
        );
        this.debugManager.addError(error instanceof Error ? error : new Error(errorMessage));
      }
    }

    // Get final response from LLM
    const finalContext = await this.mcpHost.getMCPContext();
    const finalLLMResponse = await this.getLLMResponse({
      mcpContext: finalContext,
      conversationContext: this.conversationManager.getContext(),
      userPreferences: {},
      sessionInfo: {
        startTime: this.startTime,
        lastActivity: Date.now(),
        messageCount: this.conversationManager.getMessageCount()
      }
    });

    // Check for more tool calls (recursive)
    if (finalLLMResponse.tool_calls && finalLLMResponse.tool_calls.length > 0) {
      return await this.processToolCalls(finalLLMResponse);
    }

    return finalLLMResponse.content || 'Task completed successfully.';
  }

  /**
   * Handle errors with logging and context updates
   */
  private handleError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.errors.push(errorMessage);
    this.log(`❌ Application error: ${errorMessage}`);

    // Stop application if too many errors
    const maxErrors = this.config.agentConfig.maxErrors;
    if (this.errors.length > maxErrors) {
      this.log(`🛑 Too many errors (${this.errors.length}), stopping application`);
      this.stop();
    }
  }

  /**
   * Log system summary
   */
  private async logSystemSummary(): Promise<void> {
    const stats = this.getStats();
    const health = await this.mcpHost.healthCheck();

    this.log("📊 System Summary:");
    this.log(`   • MCP Servers: ${stats.mcpServerCount}`);
    this.log(`   • Available Tools: ${health.healthyServers > 0 ? 'Available' : 'None'}`);
    this.log(`   • LLM: ${this.llmClient.isConfigured() ? 'Configured' : 'Not configured'}`);
    this.log(`   • Status: ${health.status}`);
    this.log(`   • Runtime: ${stats.runtime}s`);
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
}
