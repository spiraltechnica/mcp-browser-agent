/**
 * Enhanced tools using the new Tool abstraction layer
 * Converts existing tools to use the new architecture
 */

import { createTool, ToolResult } from './Tool';

// Simple safe math expression evaluator (reused from original)
class SafeMathEvaluator {
  private allowedChars = /^[0-9+\-*/().\s^a-zA-Z]+$/;
  
  evaluate(expression: string): number {
    // Remove whitespace
    let cleaned = expression.replace(/\s/g, '');
    
    // Convert ^ to ** for JavaScript exponentiation
    cleaned = cleaned.replace(/\^/g, '**');
    
    // Handle sqrt function
    cleaned = this.processSqrtFunction(cleaned);
    
    // Validate characters (now allowing letters for function names)
    const testExpression = expression.replace(/\s/g, '');
    if (!this.allowedChars.test(testExpression)) {
      throw new Error('Invalid characters in expression. Only numbers, +, -, *, /, ^, sqrt, (, ), and . are allowed.');
    }
    
    // Check for balanced parentheses
    let parenCount = 0;
    for (const char of cleaned) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) throw new Error('Unbalanced parentheses');
    }
    if (parenCount !== 0) throw new Error('Unbalanced parentheses');
    
    // Additional safety checks
    if (cleaned.includes('**') && cleaned.match(/\*\*\s*\d{3,}/)) {
      throw new Error('Exponent too large for safety');
    }
    
    // Evaluate using Function constructor with strict validation
    try {
      const result = Function('"use strict"; return (' + cleaned + ')')();
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Result is not a valid number');
      }
      return result;
    } catch (e) {
      throw new Error('Invalid mathematical expression: ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  }
  
  private processSqrtFunction(expression: string): string {
    // Handle sqrt function by converting sqrt(x) to Math.sqrt(x)
    // Use a simple regex replacement approach to avoid infinite loops
    
    // Replace sqrt( with Math.sqrt( using regex
    // This handles simple cases like sqrt(16), sqrt(2+7), etc.
    let processed = expression.replace(/sqrt\(/g, 'Math.sqrt(');
    
    return processed;
  }
}

/**
 * Enhanced Calculator Tool
 */
export const calculatorTool = createTool(
  'calculator',
  'Perform safe arithmetic calculations (supports +, -, *, /, ^, sqrt functions)',
  {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate (e.g., "2 + 2", "10 * 5 + 3", "sqrt(16)", "sqrt(2 + 7)", "2 * sqrt(25)")'
      }
    },
    required: ['expression']
  },
  async (args: any): Promise<ToolResult> => {
    // Enhanced parameter validation
    if (!args || typeof args !== 'object') {
      return {
        success: false,
        error: "Invalid parameters. Expected object with 'expression' property. Example: {\"expression\": \"2 + 2\"}"
      };
    }

    const { expression } = args;

    if (!expression || typeof expression !== 'string') {
      return {
        success: false,
        error: "Missing or invalid 'expression' parameter. Expected a mathematical expression string. Example: {\"expression\": \"10 + 5\"}"
      };
    }

    if (expression.trim().length === 0) {
      return {
        success: false,
        error: "Empty expression provided. Example: {\"expression\": \"3 * 4\"}"
      };
    }

    try {
      const evaluator = new SafeMathEvaluator();
      const result = evaluator.evaluate(expression);
      return {
        success: true,
        data: { result, expression }
      };
    } catch (e) {
      return {
        success: false,
        error: `Invalid mathematical expression: ${e instanceof Error ? e.message : 'Unknown error'}. Example: {\"expression\": \"2 + 2\"}`
      };
    }
  },
  'Safe Calculator'
);

/**
 * Enhanced DOM Query Tool
 */
export const domQueryTool = createTool(
  'dom_query',
  'Query and interact with DOM elements on the current page',
  {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for the element (e.g., "button", "#myId", ".myClass")'
      },
      action: {
        type: 'string',
        enum: ['query', 'click', 'text', 'value', 'exists'],
        description: 'Action to perform on the element'
      }
    },
    required: ['selector', 'action']
  },
  async (args: any): Promise<ToolResult> => {
    // Enhanced parameter validation
    if (!args || typeof args !== 'object') {
      return {
        success: false,
        error: "Invalid parameters. Expected object with 'selector' and 'action' properties."
      };
    }

    const { selector, action } = args;

    if (!selector || typeof selector !== 'string') {
      return {
        success: false,
        error: "Missing or invalid 'selector' parameter. Expected a CSS selector string. Example: {\"selector\": \"button\", \"action\": \"exists\"}"
      };
    }

    if (!action || typeof action !== 'string') {
      return {
        success: false,
        error: "Missing or invalid 'action' parameter. Expected one of: query, click, text, value, exists. Example: {\"selector\": \"h1\", \"action\": \"text\"}"
      };
    }

    const validActions = ['query', 'click', 'text', 'value', 'exists'];
    if (!validActions.includes(action)) {
      return {
        success: false,
        error: `Invalid action '${action}'. Must be one of: ${validActions.join(', ')}. Example: {\"selector\": \"button\", \"action\": \"click\"}`
      };
    }

    try {
      const element = document.querySelector(selector);
      
      switch (action) {
        case 'exists':
          return {
            success: true,
            data: { exists: !!element, selector }
          };
        case 'query':
          if (!element) {
            return {
              success: false,
              error: "Element not found"
            };
          }
          return {
            success: true,
            data: {
              exists: true,
              tagName: element.tagName,
              className: element.className,
              id: element.id,
              selector
            }
          };
        case 'click':
          if (!element) {
            return {
              success: false,
              error: "Element not found"
            };
          }
          (element as HTMLElement).click();
          return {
            success: true,
            data: { clicked: true, selector }
          };
        case 'text':
          if (!element) {
            return {
              success: false,
              error: "Element not found"
            };
          }
          return {
            success: true,
            data: { text: element.textContent || "", selector }
          };
        case 'value':
          if (!element) {
            return {
              success: false,
              error: "Element not found"
            };
          }
          return {
            success: true,
            data: { value: (element as HTMLInputElement).value || "", selector }
          };
        default:
          return {
            success: false,
            error: "Invalid action"
          };
      }
    } catch (e) {
      return {
        success: false,
        error: `DOM operation failed: ${e instanceof Error ? e.message : 'Unknown error'}`
      };
    }
  },
  'DOM Element Interaction'
);

/**
 * Enhanced Browser Storage Tool
 */
export const browserStorageTool = createTool(
  'browser_storage',
  'Interact with browser localStorage for data persistence',
  {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'set', 'remove', 'clear', 'keys'],
        description: 'Storage action to perform'
      },
      key: {
        type: 'string',
        description: 'Storage key (required for get, set, remove actions)'
      },
      value: {
        type: 'string',
        description: 'Value to store (required for set action)'
      }
    },
    required: ['action']
  },
  async (args: any): Promise<ToolResult> => {
    // Enhanced parameter validation
    if (!args || typeof args !== 'object') {
      return {
        success: false,
        error: "Invalid parameters. Expected object with 'action' property. Example: {\"action\": \"keys\"}"
      };
    }

    const { action, key, value } = args;

    if (!action || typeof action !== 'string') {
      return {
        success: false,
        error: "Missing or invalid 'action' parameter. Expected one of: get, set, remove, clear, keys. Example: {\"action\": \"set\", \"key\": \"counter\", \"value\": \"1\"}"
      };
    }

    const validActions = ['get', 'set', 'remove', 'clear', 'keys'];
    if (!validActions.includes(action)) {
      return {
        success: false,
        error: `Invalid action '${action}'. Must be one of: ${validActions.join(', ')}. Example: {\"action\": \"get\", \"key\": \"counter\"}`
      };
    }

    try {
      switch (action) {
        case 'get':
          if (!key) {
            return {
              success: false,
              error: "Key is required for get action. Example: {\"action\": \"get\", \"key\": \"counter\"}"
            };
          }
          return {
            success: true,
            data: { value: localStorage.getItem(key), key }
          };
        case 'set':
          if (!key || value === undefined) {
            return {
              success: false,
              error: "Key and value are required for set action. Example: {\"action\": \"set\", \"key\": \"counter\", \"value\": \"1\"}"
            };
          }
          localStorage.setItem(key, value);
          return {
            success: true,
            data: { success: true, key, value }
          };
        case 'remove':
          if (!key) {
            return {
              success: false,
              error: "Key is required for remove action. Example: {\"action\": \"remove\", \"key\": \"counter\"}"
            };
          }
          localStorage.removeItem(key);
          return {
            success: true,
            data: { success: true, key, removed: true }
          };
        case 'clear':
          localStorage.clear();
          return {
            success: true,
            data: { success: true, cleared: true }
          };
        case 'keys':
          return {
            success: true,
            data: { keys: Object.keys(localStorage) }
          };
        default:
          return {
            success: false,
            error: "Invalid action"
          };
      }
    } catch (e) {
      return {
        success: false,
        error: `Storage operation failed: ${e instanceof Error ? e.message : 'Unknown error'}`
      };
    }
  },
  'Browser Storage Manager'
);

/**
 * Enhanced List Tools Tool
 */
export const listToolsTool = createTool(
  'list_tools',
  'List all available MCP tools with their descriptions and schemas',
  {
    type: 'object',
    properties: {},
    required: []
  },
  async (): Promise<ToolResult> => {
    // This will be populated by the ToolManager when tools are registered
    return {
      success: true,
      data: {
        message: "This tool will be dynamically populated by the ToolManager",
        tools: []
      }
    };
  },
  'Tool Discovery'
);

/**
 * Export all enhanced tools
 */
export const enhancedTools = [
  calculatorTool,
  domQueryTool,
  browserStorageTool,
  listToolsTool
];

/**
 * Create a map of tools for easy access
 */
export const enhancedToolsMap = new Map(
  enhancedTools.map(tool => [tool.name, tool])
);
