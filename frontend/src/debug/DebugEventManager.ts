import { DebugEvent, ConversationFlow } from '../components/EnhancedDebugPanel';

export type DebugEventCallback = (event: DebugEvent) => void;
export type ConversationFlowCallback = (flow: ConversationFlow) => void;

/**
 * Central debug event manager that captures all events throughout the conversation flow
 */
export class DebugEventManager {
  private events: DebugEvent[] = [];
  private conversationFlows: ConversationFlow[] = [];
  private currentFlow: ConversationFlow | null = null;
  private eventCallbacks: DebugEventCallback[] = [];
  private flowCallbacks: ConversationFlowCallback[] = [];
  private eventIdCounter = 0;

  /**
   * Start a new conversation flow
   */
  startConversation(userMessage: string): string {
    const flowId = `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentFlow = {
      id: flowId,
      userMessage,
      timestamp: Date.now(),
      events: [],
      isComplete: false,
      totalDuration: 0
    };

    // Add user message as first event
    this.addEvent('user_message', {
      content: userMessage
    });

    return flowId;
  }

  /**
   * Complete the current conversation flow
   */
  completeConversation(finalResponse: string): void {
    if (!this.currentFlow) return;

    // Add final response event
    this.addEvent('final_response', {
      content: finalResponse
    });

    // Mark as complete and calculate total duration
    this.currentFlow.isComplete = true;
    this.currentFlow.totalDuration = Date.now() - this.currentFlow.timestamp;

    // Add to flows list
    this.conversationFlows.push({ ...this.currentFlow });

    // Keep only last 20 flows
    if (this.conversationFlows.length > 20) {
      this.conversationFlows.shift();
    }

    // Notify callbacks
    this.flowCallbacks.forEach(callback => {
      try {
        callback(this.currentFlow!);
      } catch (error) {
        console.error('Error in flow callback:', error);
      }
    });

    this.currentFlow = null;
  }

  /**
   * Add a debug event to the current conversation
   */
  addEvent(
    type: DebugEvent['type'], 
    data: any, 
    duration?: number, 
    parentId?: string
  ): string {
    const eventId = `event_${++this.eventIdCounter}`;
    
    const event: DebugEvent = {
      id: eventId,
      timestamp: Date.now(),
      type,
      data: JSON.parse(JSON.stringify(data)), // Deep clone to avoid reference issues
      duration,
      parentId
    };

    this.events.push(event);

    // Add to current flow if active
    if (this.currentFlow) {
      this.currentFlow.events.push(event);
    }

    // Keep only last 1000 events globally
    if (this.events.length > 1000) {
      this.events.shift();
    }

    // Notify callbacks
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in event callback:', error);
      }
    });

    return eventId;
  }

  /**
   * Add LLM request event
   */
  addLLMRequest(requestPayload: any): string {
    return this.addEvent('llm_request', {
      model: requestPayload.model,
      messages: requestPayload.messages,
      tools: requestPayload.tools,
      temperature: requestPayload.temperature,
      max_tokens: requestPayload.max_tokens,
      fullPayload: requestPayload
    });
  }

  /**
   * Add LLM response event
   */
  addLLMResponse(responsePayload: any, requestEventId?: string, duration?: number): string {
    return this.addEvent('llm_response', {
      content: responsePayload.content,
      tool_calls: responsePayload.tool_calls,
      usage: responsePayload.usage,
      model: responsePayload.model,
      finishReason: responsePayload.finishReason,
      fullPayload: responsePayload
    }, duration, requestEventId);
  }

  /**
   * Add tool call parsed event
   */
  addToolCallParsed(toolCall: any): string {
    let arguments_: any = {};
    try {
      arguments_ = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch (error) {
      arguments_ = { parseError: 'Failed to parse arguments', raw: toolCall.function.arguments };
    }

    return this.addEvent('tool_call_parsed', {
      toolCallId: toolCall.id,
      toolName: toolCall.function.name,
      arguments: arguments_,
      rawToolCall: toolCall
    });
  }

  /**
   * Add tool execution event
   */
  addToolExecution(toolName: string, mcpRequest: any, toolCallId?: string): string {
    return this.addEvent('tool_execution', {
      toolName,
      toolCallId,
      mcpRequest,
      timestamp: Date.now()
    });
  }

  /**
   * Add tool result event
   */
  addToolResult(
    toolName: string, 
    result: any, 
    success: boolean, 
    executionEventId?: string, 
    duration?: number
  ): string {
    return this.addEvent('tool_result', {
      toolName,
      result,
      success,
      resultType: typeof result,
      resultLength: typeof result === 'string' ? result.length : JSON.stringify(result).length
    }, duration, executionEventId);
  }

  /**
   * Add error event
   */
  addError(error: Error | string, context?: any): string {
    const errorData = error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack
    } : {
      message: error,
      name: 'Unknown Error'
    };

    return this.addEvent('error', {
      ...errorData,
      context,
      timestamp: Date.now()
    });
  }

  /**
   * Subscribe to debug events
   */
  onEvent(callback: DebugEventCallback): () => void {
    this.eventCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index > -1) {
        this.eventCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to conversation flow updates
   */
  onFlow(callback: ConversationFlowCallback): () => void {
    this.flowCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.flowCallbacks.indexOf(callback);
      if (index > -1) {
        this.flowCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get all conversation flows
   */
  getConversationFlows(): ConversationFlow[] {
    return [...this.conversationFlows];
  }

  /**
   * Get current conversation flow
   */
  getCurrentFlow(): ConversationFlow | null {
    return this.currentFlow ? { ...this.currentFlow } : null;
  }

  /**
   * Get all events
   */
  getAllEvents(): DebugEvent[] {
    return [...this.events];
  }

  /**
   * Get events for a specific conversation
   */
  getEventsForFlow(flowId: string): DebugEvent[] {
    const flow = this.conversationFlows.find(f => f.id === flowId);
    return flow ? [...flow.events] : [];
  }

  /**
   * Clear all debug data
   */
  clear(): void {
    this.events = [];
    this.conversationFlows = [];
    this.currentFlow = null;
    this.eventIdCounter = 0;
  }

  /**
   * Get debug statistics including token usage totals
   */
  getStats(): {
    totalEvents: number;
    totalFlows: number;
    activeFlow: boolean;
    eventTypes: Record<string, number>;
    tokenUsage: {
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
      totalLLMCalls: number;
    };
  } {
    const eventTypes: Record<string, number> = {};
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let totalLLMCalls = 0;
    
    this.events.forEach(event => {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
      
      // Track token usage from LLM responses
      if (event.type === 'llm_response' && event.data.usage) {
        totalTokens += event.data.usage.total_tokens || 0;
        promptTokens += event.data.usage.prompt_tokens || 0;
        completionTokens += event.data.usage.completion_tokens || 0;
        totalLLMCalls++;
      }
    });

    return {
      totalEvents: this.events.length,
      totalFlows: this.conversationFlows.length,
      activeFlow: !!this.currentFlow,
      eventTypes,
      tokenUsage: {
        totalTokens,
        promptTokens,
        completionTokens,
        totalLLMCalls
      }
    };
  }

  /**
   * Get token usage statistics for all conversations
   */
  getTokenUsageStats(): {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    totalLLMCalls: number;
    conversationCount: number;
  } {
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let totalLLMCalls = 0;

    this.conversationFlows.forEach(flow => {
      flow.events.forEach(event => {
        if (event.type === 'llm_response' && event.data.usage) {
          totalTokens += event.data.usage.total_tokens || 0;
          promptTokens += event.data.usage.prompt_tokens || 0;
          completionTokens += event.data.usage.completion_tokens || 0;
          totalLLMCalls++;
        }
      });
    });

    return {
      totalTokens,
      promptTokens,
      completionTokens,
      totalLLMCalls,
      conversationCount: this.conversationFlows.length
    };
  }

  /**
   * Export debug data for analysis
   */
  exportData(): {
    flows: ConversationFlow[];
    events: DebugEvent[];
    stats: any;
    exportTime: number;
  } {
    return {
      flows: this.getConversationFlows(),
      events: this.getAllEvents(),
      stats: this.getStats(),
      exportTime: Date.now()
    };
  }

  /**
   * Import debug data
   */
  importData(data: {
    flows: ConversationFlow[];
    events: DebugEvent[];
  }): void {
    this.conversationFlows = [...data.flows];
    this.events = [...data.events];
    
    // Update counter to avoid ID conflicts
    const maxEventId = Math.max(
      ...this.events.map(e => {
        const match = e.id.match(/event_(\d+)/);
        return match ? parseInt(match[1]) : 0;
      }),
      0
    );
    this.eventIdCounter = maxEventId;
  }
}

/**
 * Global debug event manager instance
 */
let globalDebugEventManager: DebugEventManager | null = null;

/**
 * Get the global debug event manager instance
 */
export function getDebugEventManager(): DebugEventManager {
  if (!globalDebugEventManager) {
    globalDebugEventManager = new DebugEventManager();
  }
  return globalDebugEventManager;
}

/**
 * Reset the global debug event manager (useful for testing)
 */
export function resetDebugEventManager(): void {
  globalDebugEventManager = null;
}
