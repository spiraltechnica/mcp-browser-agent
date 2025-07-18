/**
 * Enhanced LLM Client following the Python implementation pattern
 * Manages communication with the LLM provider with proper error handling
 */

import { getConfig, ConfigurationError } from '../config/Configuration';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
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

export interface LLMRequestOptions {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  responseFormat?: { type: string };
  timeout?: number;
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
        responseFormat: options?.responseFormat ?? llmConfig.responseFormat,
        timeout: options?.timeout ?? llmConfig.timeout
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
    const payload = {
      messages: JSON.parse(JSON.stringify(options.messages)), // Deep copy of messages
      model: options.model,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      response_format: options.responseFormat
    };

    console.log(`🌐 [${requestId}] Sending request to backend ${apiConfig.llmEndpoint}`);
    console.log(`⚙️ [${requestId}] Request config:`, {
      model: payload.model,
      temperature: payload.temperature,
      max_tokens: payload.max_tokens,
      messages_count: payload.messages.length
    });

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout);

      const response = await fetch(apiConfig.llmEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
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

      // Parse response
      const responseText = await response.text();
      console.log(`📥 [${requestId}] Raw response length: ${responseText.length} characters`);

      // Try to parse as JSON first (for structured responses)
      let content: string;
      let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      let responsePayload: any;
      
      try {
        responsePayload = JSON.parse(responseText);
        
        // Handle backend fallback responses
        if (responsePayload.fallback) {
          console.warn(`🔄 [${requestId}] Using backend fallback response`);
          content = JSON.stringify(responsePayload.fallback);
        } else {
          // Extract content from structured response
          content = this.extractContent(responsePayload);
          usage = responsePayload.usage || usage;
        }
      } catch (parseError) {
        // If JSON parsing fails, treat as plain text response
        console.log(`📝 [${requestId}] Treating response as plain text`);
        content = responseText;
        responsePayload = { content: responseText, raw: true };
      }

      console.log(`📊 [${requestId}] Token usage:`, usage);
      console.log(`🤖 [${requestId}] Response content length: ${content.length} characters`);

      // Create debug info
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
        usage,
        model: options.model,
        finishReason: 'stop',
        requestPayload: payload,
        responsePayload,
        requestTime,
        responseTime
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
   * Build a prompt string from messages array for backend compatibility
   */
  private buildPromptFromMessages(messages: Message[]): string {
    return messages.map(msg => {
      if (msg.role === 'system') {
        return `System: ${msg.content}`;
      } else if (msg.role === 'user') {
        return `User: ${msg.content}`;
      } else if (msg.role === 'assistant') {
        return `Assistant: ${msg.content}`;
      }
      return msg.content;
    }).join('\n\n');
  }

  /**
   * Extract content from LLM response
   */
  private extractContent(responseData: any): string {
    // Handle different response formats
    if (responseData.choices && responseData.choices.length > 0) {
      const choice = responseData.choices[0];
      
      if (choice.message && choice.message.content) {
        return choice.message.content;
      }
      
      if (choice.text) {
        return choice.text;
      }
    }

    // Fallback for direct content
    if (responseData.content) {
      return responseData.content;
    }

    // If we have a fallback decision (from backend error handling)
    if (responseData.fallback) {
      console.warn('Using fallback decision from backend');
      return JSON.stringify(responseData.fallback);
    }

    throw new LLMError('No content found in LLM response');
  }

  /**
   * Parse LLM response for tool calls
   * Similar to Python's process_llm_response method
   */
  parseToolCall(response: string): { tool?: string; arguments?: any; isToolCall: boolean } {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(response.trim());
      
      // Check for tool call format
      if (parsed.tool && parsed.arguments) {
        return {
          tool: parsed.tool,
          arguments: parsed.arguments,
          isToolCall: true
        };
      }
      
      // Check for alternative formats
      if (parsed.action === 'tool' && parsed.tool) {
        return {
          tool: parsed.tool,
          arguments: parsed.params || parsed.arguments || {},
          isToolCall: true
        };
      }
      
      return { isToolCall: false };
      
    } catch (error) {
      // Try to extract JSON from text
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.tool && parsed.arguments) {
            return {
              tool: parsed.tool,
              arguments: parsed.arguments,
              isToolCall: true
            };
          }
        } catch {
          // Continue to return false
        }
      }
      
      return { isToolCall: false };
    }
  }

  /**
   * Build system prompt with tool information
   * Similar to Python's system message building
   */
  buildSystemPrompt(toolsDescription: string): string {
    return `You are a helpful AI assistant that can have natural conversations and use tools when needed.

Available tools:
${toolsDescription}

CRITICAL INSTRUCTIONS:
- When a user asks you to DO something that requires a tool (calculate, store data, query DOM, etc.), you MUST use the appropriate tool
- When you need to use a tool, respond with ONLY this exact JSON format, NO OTHER TEXT:
{
    "tool": "tool-name",
    "arguments": {
        "argument-name": "value"
    }
}
- DO NOT include any explanatory text, descriptions, or conversation when using a tool
- The JSON must be the COMPLETE and ONLY response
- After using a tool, you'll receive the result and should respond naturally in plain text
- For simple greetings or thanks, respond conversationally without tools
- If a user asks you to do multiple things, use ONE tool at a time - the system will call you again for the next step

Examples:
- User: "Hi" → You: "Hello! How can I help you today?"
- User: "Calculate 5 + 3" → You: {"tool": "calculator", "arguments": {"expression": "5 + 3"}}
- User: "Store my name as John" → You: {"tool": "browser_storage", "arguments": {"action": "set", "key": "name", "value": "John"}}
- User: "What tools do you have?" → You: {"tool": "list_tools", "arguments": {}}

IMPORTANT: If you're asked to do calculations, storage operations, or DOM queries, you MUST use the tools, not just describe what you would do.`;
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
