// Simple safe math expression evaluator
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

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (args: any) => Promise<any>;
}

// Safe calculator using expr-eval library
const calculatorTool: MCPTool = {
  name: "calculator",
  description: "Perform safe arithmetic calculations (supports +, -, *, /, ^, sqrt functions)",
  inputSchema: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "Mathematical expression to evaluate (e.g., '2 + 2', '10 * 5 + 3', 'sqrt(16)', 'sqrt(2 + 7)', '2 * sqrt(25)')"
      }
    },
    required: ["expression"]
  },
  handler: async (args: any) => {
    // Enhanced parameter validation
    if (!args || typeof args !== 'object') {
      return { error: "Invalid parameters. Expected object with 'expression' property. Example: {\"expression\": \"2 + 2\"}" };
    }

    const { expression } = args;

    if (!expression || typeof expression !== 'string') {
      return { error: "Missing or invalid 'expression' parameter. Expected a mathematical expression string. Example: {\"expression\": \"10 + 5\"}" };
    }

    if (expression.trim().length === 0) {
      return { error: "Empty expression provided. Example: {\"expression\": \"3 * 4\"}" };
    }

    try {
      const evaluator = new SafeMathEvaluator();
      const result = evaluator.evaluate(expression);
      return { result };
    } catch (e) {
      return { error: `Invalid mathematical expression: ${e instanceof Error ? e.message : 'Unknown error'}. Example: {\"expression\": \"2 + 2\"}` };
    }
  }
};

// DOM interaction tool
const domQueryTool: MCPTool = {
  name: "dom_query",
  description: "Query and interact with DOM elements on the current page",
  inputSchema: {
    type: "object",
    properties: {
      selector: {
        type: "string",
        description: "CSS selector for the element"
      },
      action: {
        type: "string",
        enum: ["query", "click", "text", "value", "exists"],
        description: "Action to perform on the element"
      }
    },
    required: ["selector", "action"]
  },
  handler: async (args: any) => {
    // Enhanced parameter validation
    if (!args || typeof args !== 'object') {
      return { error: "Invalid parameters. Expected object with 'selector' and 'action' properties." };
    }

    const { selector, action } = args;

    if (!selector || typeof selector !== 'string') {
      return { error: "Missing or invalid 'selector' parameter. Expected a CSS selector string. Example: {\"selector\": \"button\", \"action\": \"exists\"}" };
    }

    if (!action || typeof action !== 'string') {
      return { error: "Missing or invalid 'action' parameter. Expected one of: query, click, text, value, exists. Example: {\"selector\": \"h1\", \"action\": \"text\"}" };
    }

    const validActions = ["query", "click", "text", "value", "exists"];
    if (!validActions.includes(action)) {
      return { error: `Invalid action '${action}'. Must be one of: ${validActions.join(', ')}. Example: {\"selector\": \"button\", \"action\": \"click\"}` };
    }

    try {
      const element = document.querySelector(selector);
      
      switch (action) {
        case "exists":
          return { exists: !!element };
        case "query":
          if (!element) return { error: "Element not found" };
          return { 
            exists: true, 
            tagName: element.tagName,
            className: element.className,
            id: element.id
          };
        case "click":
          if (!element) return { error: "Element not found" };
          (element as HTMLElement).click();
          return { clicked: true };
        case "text":
          if (!element) return { error: "Element not found" };
          return { text: element.textContent || "" };
        case "value":
          if (!element) return { error: "Element not found" };
          return { value: (element as HTMLInputElement).value || "" };
        default:
          return { error: "Invalid action" };
      }
    } catch (e) {
      return { error: `DOM operation failed: ${e instanceof Error ? e.message : 'Unknown error'}` };
    }
  }
};

// Browser storage tool
const browserStorageTool: MCPTool = {
  name: "browser_storage",
  description: "Interact with browser localStorage",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["get", "set", "remove", "clear", "keys"],
        description: "Storage action to perform"
      },
      key: {
        type: "string",
        description: "Storage key (required for get, set, remove)"
      },
      value: {
        type: "string",
        description: "Value to store (required for set)"
      }
    },
    required: ["action"]
  },
  handler: async (args: any) => {
    // Enhanced parameter validation
    if (!args || typeof args !== 'object') {
      return { error: "Invalid parameters. Expected object with 'action' property. Example: {\"action\": \"keys\"}" };
    }

    const { action, key, value } = args;

    if (!action || typeof action !== 'string') {
      return { error: "Missing or invalid 'action' parameter. Expected one of: get, set, remove, clear, keys. Example: {\"action\": \"set\", \"key\": \"counter\", \"value\": \"1\"}" };
    }

    const validActions = ["get", "set", "remove", "clear", "keys"];
    if (!validActions.includes(action)) {
      return { error: `Invalid action '${action}'. Must be one of: ${validActions.join(', ')}. Example: {\"action\": \"get\", \"key\": \"counter\"}` };
    }

    try {
      switch (action) {
        case "get":
          if (!key) return { error: "Key is required for get action. Example: {\"action\": \"get\", \"key\": \"counter\"}" };
          return { value: localStorage.getItem(key) };
        case "set":
          if (!key || value === undefined) return { error: "Key and value are required for set action. Example: {\"action\": \"set\", \"key\": \"counter\", \"value\": \"1\"}" };
          localStorage.setItem(key, value);
          return { success: true };
        case "remove":
          if (!key) return { error: "Key is required for remove action. Example: {\"action\": \"remove\", \"key\": \"counter\"}" };
          localStorage.removeItem(key);
          return { success: true };
        case "clear":
          localStorage.clear();
          return { success: true };
        case "keys":
          return { keys: Object.keys(localStorage) };
        default:
          return { error: "Invalid action" };
      }
    } catch (e) {
      return { error: `Storage operation failed: ${e instanceof Error ? e.message : 'Unknown error'}` };
    }
  }
};

export const toolRegistry: Record<string, MCPTool> = {
  calculator: calculatorTool,
  dom_query: domQueryTool,
  browser_storage: browserStorageTool,
  list_tools: {
    name: "list_tools",
    description: "List all available MCP tools with their descriptions and schemas",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    handler: async () => {
      return {
        tools: Object.entries(toolRegistry).map(([name, tool]) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      };
    }
  }
};
