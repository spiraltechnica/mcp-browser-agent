/**
 * Enhanced LLM Client following the Python implementation pattern
 * Manages communication with the LLM provider with proper error handling
 */

import { getConfig, ConfigurationError } from '../config/Configuration';

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string; // For tool messages
}

export interface LLMResponse {
  content: string | null;
  tool_calls?: ToolCall[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
  finishReason?: string;
  // Debug information
  requestPayload?: any;
  responsePayload?: any;
  requestTime?: number;
  responseTime?: number;
  // Raw HTTP data for accurate debugging
  rawRequestBody?: string;
  rawResponseBody?: string;
}

export interface LLMDebugInfo {
  id: string;
  timestamp: number;
  requestPayload: any;
  responsePayload: any;
  requestTime: number;
  responseTime: number;
  duration: number;
  model: string;
  tokenUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MCPTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: any; // JSON Schema
  };
}

export interface LLMRequestOptions {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  responseFormat?: { type: string };
  timeout?: number;
  tools?: MCPTool[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
}

/**
 * LLM Client error class
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: any
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

/**
 * Enhanced LLM Client with comprehensive error handling and retry logic
 * Similar to the Python LLMClient class
 */
export class LLMClient {
  private config = getConfig();
  private requestId = 0;
  private debugHistory: LLMDebugInfo[] = [];
  private onDebugUpdate?: (debugInfo: LLMDebugInfo) => void;

  constructor() {
    // Validate configuration on initialization
    if (!this.config.hasApiKey) {
      console.warn('LLM API key not configured. Some features may not work.');
    }
  }

  /**
   * Set debug callback for real-time debug updates
   */
  setDebugCallback(callback: (debugInfo: LLMDebugInfo) => void): void {
    this.onDebugUpdate = callback;
  }

  /**
   * Get debug history
   */
  getDebugHistory(): LLMDebugInfo[] {
    return [...this.debugHistory];
  }

  /**
   * Clear debug history
   */
  clearDebugHistory(): void {
    this.debugHistory = [];
  }

  /**
   * Get a response from the LLM
   * Similar to Python's get_response method
   */
  async getResponse(messages: Message[], options?: Partial<LLMRequestOptions>): Promise<LLMResponse> {
    const requestId = ++this.requestId;
    const startTime = Date.now();

    try {
      // Validate input
      if (!messages || messages.length === 0) {
        throw new LLMError('Messages array is required and cannot be empty');
      }

      // Validate API key
      if (!this.config.hasApiKey) {
        throw new ConfigurationError('LLM API key not configured');
      }

      // Build request options
      const llmConfig = this.config.llmConfig;
      const requestOptions: LLMRequestOptions = {
        messages,
        temperature: options?.temperature ?? llmConfig.temperature,
        maxTokens: options?.maxTokens ?? llmConfig.maxTokens,
        model: options?.model ?? llmConfig.model,
        responseFormat: options?.responseFormat,
        timeout: options?.timeout ?? llmConfig.timeout,
        tools: options?.tools,
        tool_choice: options?.tool_choice
      };

      console.log(`🚀 [${requestId}] LLM Request started`);
      console.log(`📝 [${requestId}] Messages: ${messages.length}, Model: ${requestOptions.model}`);

      // Make the API request
      const response = await this.makeRequest(requestId, requestOptions);
      
      const responseTime = Date.now() - startTime;
      console.log(`✅ [${requestId}] LLM Response received in ${responseTime}ms`);

      return response;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`❌ [${requestId}] LLM Request failed after ${responseTime}ms:`, error);
      
      // Re-throw with additional context
      if (error instanceof LLMError || error instanceof ConfigurationError) {
        throw error;
      }
      
      throw new LLMError(
        `LLM request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }

  /**
   * Make the actual HTTP request to the LLM API via backend proxy
   */
  private async makeRequest(requestId: number, options: LLMRequestOptions): Promise<LLMResponse> {
    const apiConfig = this.config.apiConfig;
    const requestTime = Date.now();
    
    // Prepare request payload for backend (using messages array)
    // Create a deep copy to avoid reference issues in debug history
    const payload: any = {
      messages: JSON.parse(JSON.stringify(options.messages)), // Deep copy of messages
      model: options.model,
      temperature: options.temperature,
      max_tokens: options.maxTokens
    };

    // Only add response_format if explicitly provided
    if (options.responseFormat) {
      payload.response_format = options.responseFormat;
    }

    // Add tools array if provided
    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools;
      payload.tool_choice = options.tool_choice || "auto";
    }

    // Capture the raw request body that will be sent
    const rawRequestBody = JSON.stringify(payload);

    console.log(`🌐 [${requestId}] Sending request to backend ${apiConfig.llmEndpoint}`);
    console.log(`⚙️ [${requestId}] Request config:`, {
      model: payload.model,
      temperature: payload.temperature,
      max_tokens: payload.max_tokens,
      messages_count: payload.messages.length,
      tools_count: payload.tools ? payload.tools.length : 0,
      tool_choice: payload.tool_choice
    });
    
    if (payload.tools && payload.tools.length > 0) {
      console.log(`🔧 [${requestId}] Tools available:`, payload.tools.map((t: any) => t.function.name));
    }

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout);

      const response = await fetch(apiConfig.llmEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: rawRequestBody,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now();

      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = `${errorData.error}: ${errorText}`;
          }
          // Handle backend fallback responses
          if (errorData.fallback) {
            console.warn(`🔄 [${requestId}] Using backend fallback response`);
            
            // Create debug info for fallback response
            const debugInfo: LLMDebugInfo = {
              id: `req-${requestId}`,
              timestamp: requestTime,
              requestPayload: payload,
              responsePayload: errorData,
              requestTime,
              responseTime,
              duration: responseTime - requestTime,
              model: options.model || 'unknown',
              tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
            };
            
            this.addDebugInfo(debugInfo);
            
            return {
              content: JSON.stringify(errorData.fallback),
              usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
              model: options.model,
              finishReason: 'fallback',
              requestPayload: payload,
              responsePayload: errorData,
              requestTime,
              responseTime
            };
          }
        } catch {
          // Use raw error text if JSON parsing fails
          errorMessage = `HTTP ${response.status}: ${errorText}`;
        }

        throw new LLMError(errorMessage, response.status, errorText);
      }

      // Capture the raw response text before any processing
      const rawResponseBody = await response.text();
      console.log(`📥 [${requestId}] Raw response length: ${rawResponseBody.length} characters`);

      // Try to parse as JSON first (for structured responses)
      let content: string | null = null;
      let tool_calls: ToolCall[] | undefined = undefined;
      let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      let responsePayload: any;
      
      try {
        responsePayload = JSON.parse(rawResponseBody);
        
        // Handle backend fallback responses
        if (responsePayload.fallback) {
          console.warn(`🔄 [${requestId}] Using backend fallback response`);
          content = JSON.stringify(responsePayload.fallback);
        } else {
          // Extract content and tool_calls from structured response
          const extracted = this.extractContentAndToolCalls(responsePayload);
          content = extracted.content;
          tool_calls = extracted.tool_calls;
          usage = responsePayload.usage || usage;
        }
      } catch (parseError) {
        // If JSON parsing fails, treat as plain text response
        console.log(`📝 [${requestId}] Treating response as plain text`);
        content = rawResponseBody;
        responsePayload = { content: rawResponseBody, raw: true };
      }

      console.log(`📊 [${requestId}] Token usage:`, usage);
      console.log(`🤖 [${requestId}] Response content: ${content ? content.length : 0} characters`);
      if (tool_calls && tool_calls.length > 0) {
        console.log(`🔧 [${requestId}] Tool calls: ${tool_calls.length}`);
      }

      // Create debug info with raw HTTP data
      const debugInfo: LLMDebugInfo = {
        id: `req-${requestId}`,
        timestamp: requestTime,
        requestPayload: payload,
        responsePayload,
        requestTime,
        responseTime,
        duration: responseTime - requestTime,
        model: options.model || 'unknown',
        tokenUsage: usage
      };
      
      this.addDebugInfo(debugInfo);

      return {
        content,
        tool_calls,
        usage,
        model: options.model,
        finishReason: 'stop',
        requestPayload: payload,
        responsePayload,
        requestTime,
        responseTime,
        rawRequestBody,
        rawResponseBody
      };

    } catch (error) {
      const responseTime = Date.now();
      
      // Create debug info for errors
      const debugInfo: LLMDebugInfo = {
        id: `req-${requestId}`,
        timestamp: requestTime,
        requestPayload: payload,
        responsePayload: { error: error instanceof Error ? error.message : 'Unknown error' },
        requestTime,
        responseTime,
        duration: responseTime - requestTime,
        model: options.model || 'unknown'
      };
      
      this.addDebugInfo(debugInfo);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new LLMError(`Request timeout after ${options.timeout}ms`);
      }
      
      if (error instanceof LLMError) {
        throw error;
      }
      
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new LLMError('Network error: Unable to reach backend LLM proxy');
      }
      
      throw new LLMError(`Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add debug information to history and notify callback
   */
  private addDebugInfo(debugInfo: LLMDebugInfo): void {
    // Keep only last 50 debug entries
    if (this.debugHistory.length >= 50) {
      this.debugHistory.shift();
    }
    
    this.debugHistory.push(debugInfo);
    
    // Notify callback if set
    if (this.onDebugUpdate) {
      this.onDebugUpdate(debugInfo);
    }
  }


  /**
   * Extract content and tool calls from LLM response (MCP standard format)
   */
  private extractContentAndToolCalls(responseData: any): { content: string | null; tool_calls?: ToolCall[] } {
    // Handle OpenAI Chat Completions API format
    if (responseData.choices && responseData.choices.length > 0) {
      const choice = responseData.choices[0];
      
      if (choice.message) {
        const message = choice.message;
        return {
          content: message.content || null,
          tool_calls: message.tool_calls || undefined
        };
      }
      
      // Legacy format
      if (choice.text) {
        return { content: choice.text };
      }
    }

    // Fallback for direct content
    if (responseData.content !== undefined) {
      return { content: responseData.content };
    }

    // If we have a fallback decision (from backend error handling)
    if (responseData.fallback) {
      console.warn('Using fallback decision from backend');
      return { content: JSON.stringify(responseData.fallback) };
    }

    throw new LLMError('No content found in LLM response');
  }


  /**
   * Parse tool calls from MCP standard response
   */
  parseToolCalls(response: LLMResponse): ToolCall[] {
    return response.tool_calls || [];
  }

  /**
   * Create a tool message for MCP standard format
   */
  createToolMessage(toolCallId: string, toolName: string, result: string): Message {
    return {
      role: 'tool',
      tool_call_id: toolCallId,
      name: toolName,
      content: result
    };
  }

  /**
   * Generate unique tool call ID
   */
  generateToolCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if the LLM client is properly configured
   */
  isConfigured(): boolean {
    return this.config.hasApiKey;
  }

  /**
   * Get configuration summary
   */
  getConfigSummary(): Record<string, any> {
    return {
      hasApiKey: this.config.hasApiKey,
      model: this.config.llmConfig.model,
      temperature: this.config.llmConfig.temperature,
      maxTokens: this.config.llmConfig.maxTokens,
      timeout: this.config.llmConfig.timeout
    };
  }
}

/**
 * Global LLM client instance
 */
let globalLLMClient: LLMClient | null = null;

/**
 * Get the global LLM client instance
 */
export function getLLMClient(): LLMClient {
  if (!globalLLMClient) {
    globalLLMClient = new LLMClient();
  }
  return globalLLMClient;
}

/**
 * Reset the global LLM client (useful for testing)
 */
export function resetLLMClient(): void {
  globalLLMClient = null;
}
