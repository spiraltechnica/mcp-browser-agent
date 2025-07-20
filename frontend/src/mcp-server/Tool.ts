/**
 * Enhanced Tool abstraction layer following the Python MCP implementation pattern
 * Provides structured tool management with LLM-optimized formatting
 */

export interface ToolInputSchema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export type ToolHandler = (args: any) => Promise<ToolResult>;

/**
 * Enhanced Tool class with LLM formatting and validation
 * Similar to the Python Tool class
 */
export class Tool {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly inputSchema: ToolInputSchema,
    public readonly handler: ToolHandler,
    public readonly title?: string
  ) {}

  /**
   * Format tool information for LLM consumption
   * Matches the Python format_for_llm method
   */
  formatForLLM(): string {
    const argsDesc: string[] = [];
    
    if (this.inputSchema.properties) {
      for (const [paramName, paramInfo] of Object.entries(this.inputSchema.properties)) {
        let argDesc = `- ${paramName}: ${paramInfo.description || 'No description'}`;
        
        if (this.inputSchema.required?.includes(paramName)) {
          argDesc += ' (required)';
        }
        
        // Add type information if available
        if (paramInfo.type) {
          argDesc += ` [${paramInfo.type}]`;
        }
        
        // Add enum values if available
        if (paramInfo.enum) {
          argDesc += ` (options: ${paramInfo.enum.join(', ')})`;
        }
        
        argsDesc.push(argDesc);
      }
    }

    // Build the formatted output with title as a separate field
    let output = `Tool: ${this.name}\n`;

    // Add human-readable title if available
    if (this.title) {
      output += `User-readable title: ${this.title}\n`;
    }

    output += `Description: ${this.description}\n`;
    output += `Arguments:\n${argsDesc.join('\n')}\n`;

    return output;
  }

  /**
   * Execute the tool with validation and error handling
   */
  async execute(args: any): Promise<ToolResult> {
    try {
      // Validate required parameters
      if (this.inputSchema.required) {
        for (const requiredParam of this.inputSchema.required) {
          if (args[requiredParam] === undefined || args[requiredParam] === null) {
            return {
              success: false,
              error: `Missing required parameter: ${requiredParam}. Expected parameters: ${JSON.stringify(this.inputSchema.required)}`
            };
          }
        }
      }

      // Validate parameter types if specified
      if (this.inputSchema.properties && args) {
        for (const [paramName, paramValue] of Object.entries(args)) {
          const paramSchema = this.inputSchema.properties[paramName];
          if (paramSchema && paramSchema.type) {
            const actualType = typeof paramValue;
            const expectedType = paramSchema.type;
            
            if (expectedType === 'string' && actualType !== 'string') {
              return {
                success: false,
                error: `Parameter '${paramName}' must be a string, got ${actualType}`
              };
            }
            
            if (expectedType === 'number' && actualType !== 'number') {
              return {
                success: false,
                error: `Parameter '${paramName}' must be a number, got ${actualType}`
              };
            }
            
            // Validate enum values
            if (paramSchema.enum && !paramSchema.enum.includes(paramValue)) {
              return {
                success: false,
                error: `Parameter '${paramName}' must be one of: ${paramSchema.enum.join(', ')}, got '${paramValue}'`
              };
            }
          }
        }
      }

      // Execute the tool handler
      const result = await this.handler(args);
      
      return {
        success: true,
        data: result,
        metadata: {
          toolName: this.name,
          executedAt: new Date().toISOString(),
          parameters: args
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          toolName: this.name,
          executedAt: new Date().toISOString(),
          parameters: args
        }
      };
    }
  }

  /**
   * Get tool schema for MCP protocol
   */
  getSchema(): { name: string; description: string; inputSchema: ToolInputSchema } {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema
    };
  }

  /**
   * Validate tool definition
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.name || typeof this.name !== 'string') {
      errors.push('Tool name is required and must be a string');
    }

    if (!this.description || typeof this.description !== 'string') {
      errors.push('Tool description is required and must be a string');
    }

    if (!this.inputSchema || typeof this.inputSchema !== 'object') {
      errors.push('Tool inputSchema is required and must be an object');
    }

    if (!this.handler || typeof this.handler !== 'function') {
      errors.push('Tool handler is required and must be a function');
    }

    // Validate schema structure
    if (this.inputSchema) {
      if (!this.inputSchema.type) {
        errors.push('inputSchema must have a type property');
      }

      if (this.inputSchema.required && !Array.isArray(this.inputSchema.required)) {
        errors.push('inputSchema.required must be an array');
      }

      if (this.inputSchema.properties && typeof this.inputSchema.properties !== 'object') {
        errors.push('inputSchema.properties must be an object');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Tool creation helper function
 */
export function createTool(
  name: string,
  description: string,
  inputSchema: ToolInputSchema,
  handler: ToolHandler,
  title?: string
): Tool {
  const tool = new Tool(name, description, inputSchema, handler, title);
  
  // Validate the tool definition
  const validation = tool.validate();
  if (!validation.valid) {
    throw new Error(`Invalid tool definition for '${name}': ${validation.errors.join(', ')}`);
  }
  
  return tool;
}

/**
 * Tool execution error class
 */
export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly parameters?: any
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}
