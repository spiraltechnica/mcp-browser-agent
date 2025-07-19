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
  'Calculate mathematical expressions. Use this when users ask to calculate, compute, solve math problems, or need arithmetic operations. Supports: addition (+), subtraction (-), multiplication (*), division (/), exponents (^), square root (sqrt). Examples: "2+2", "sqrt(16)", "10*5+3".',
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
 * Enhanced DOM Query Tool with text-based searching and comprehensive features
 */
export const domQueryTool = createTool(
  'dom_query',
  'Interact with webpage elements and control scrolling. Use this to: CLICK buttons/links (action="click"), FIND elements by text (partialText="button text"), GET page info (action="get_page_info"), READ text from elements (action="text"), FILL forms (action="value", value="text to enter"), CHECK if elements exist (action="exists"), SCROLL pages/elements (action="scroll_page/scroll_in_element/scroll_to_element"), GET scroll info (action="get_scroll_info"), READ/WRITE HTML content (action="innerHTML", innerHTML="<p>content</p>"). Can find elements by: CSS selector, text content, placeholder text, or label text. Perfect for: clicking buttons, filling forms, reading page content, navigating websites, scrolling through content, dynamically updating page content.',
  {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for the element (e.g., "button", "#myId", ".myClass"). Optional if using text-based search.'
      },
      textContent: {
        type: 'string',
        description: 'Find elements containing this exact text (case-sensitive by default)'
      },
      partialText: {
        type: 'string',
        description: 'Find elements containing this text as a substring'
      },
      placeholder: {
        type: 'string',
        description: 'Find input elements by placeholder text'
      },
      label: {
        type: 'string',
        description: 'Find input elements by their associated label text'
      },
      action: {
        type: 'string',
        enum: ['query', 'click', 'text', 'value', 'exists', 'find_all', 'get_form', 'get_page_info', 'scroll_to_element', 'scroll_in_element', 'scroll_page', 'get_scroll_info', 'innerHTML'],
        description: 'Action to perform on the element(s)'
      },
      index: {
        type: 'number',
        description: 'Which element to select if multiple found (0-based index, default: 0)'
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Whether text searches should be case-sensitive (default: false)'
      },
      value: {
        type: 'string',
        description: 'Value to set (for input elements when action is "value")'
      },
      innerHTML: {
        type: 'string',
        description: 'HTML content to set (for action="innerHTML"). If not provided, will return current innerHTML.'
      },
      scrollDirection: {
        type: 'string',
        enum: ['up', 'down', 'left', 'right', 'top', 'bottom'],
        description: 'Direction to scroll (for scroll actions)'
      },
      scrollAmount: {
        type: 'number',
        description: 'Amount to scroll in pixels, or use "page" for page-sized scrolls (default: 300)'
      },
      smooth: {
        type: 'boolean',
        description: 'Whether to use smooth scrolling (default: true)'
      },
      autoScroll: {
        type: 'boolean',
        description: 'Automatically scroll element into view before interacting (default: false)'
      }
    },
    required: ['action']
  },
  async (args: any): Promise<ToolResult> => {
    // Enhanced parameter validation
    if (!args || typeof args !== 'object') {
      return {
        success: false,
        error: "Invalid parameters. Expected object with 'action' property."
      };
    }

    const { 
      selector, 
      textContent, 
      partialText, 
      placeholder, 
      label, 
      action, 
      index = 0, 
      caseSensitive = false,
      value,
      innerHTML,
      scrollDirection,
      scrollAmount = 300,
      smooth = true,
      autoScroll = false
    } = args;

    if (!action || typeof action !== 'string') {
      return {
        success: false,
        error: "Missing or invalid 'action' parameter. Expected one of: query, click, text, value, exists, find_all, get_form, get_page_info, scroll_to_element, scroll_in_element, scroll_page, get_scroll_info, innerHTML"
      };
    }

    const validActions = ['query', 'click', 'text', 'value', 'exists', 'find_all', 'get_form', 'get_page_info', 'scroll_to_element', 'scroll_in_element', 'scroll_page', 'get_scroll_info', 'innerHTML'];
    if (!validActions.includes(action)) {
      return {
        success: false,
        error: `Invalid action '${action}'. Must be one of: ${validActions.join(', ')}`
      };
    }

    // Helper function to find elements by text content
    const findElementsByText = (searchText: string, partial: boolean = false): Element[] => {
      const searchValue = caseSensitive ? searchText : searchText.toLowerCase();
      
      // First, try to find interactive elements (buttons, links, etc.) with the text
      const interactiveSelectors = [
        'button',
        'input[type="button"]',
        'input[type="submit"]',
        'input[type="reset"]',
        'a',
        '[role="button"]',
        '[onclick]'
      ];
      
      const interactiveElements: Element[] = [];
      
      for (const selector of interactiveSelectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        for (const el of elements) {
          const text = el.textContent || (el as HTMLInputElement).value || '';
          const elementText = caseSensitive ? text : text.toLowerCase();
          
          const matches = partial ? 
            elementText.includes(searchValue) : 
            elementText.trim() === searchValue.trim();
            
          if (matches) {
            interactiveElements.push(el);
          }
        }
      }
      
      // If we found interactive elements, return those
      if (interactiveElements.length > 0) {
        return interactiveElements;
      }
      
      // Otherwise, search all elements but exclude large containers
      const excludeSelectors = ['html', 'body', 'main', 'div.container', 'section', 'article'];
      const allElements = Array.from(document.querySelectorAll('*'));
      
      return allElements.filter(el => {
        // Skip large container elements
        if (excludeSelectors.includes(el.tagName.toLowerCase()) || 
            excludeSelectors.some(sel => el.matches && el.matches(sel))) {
          return false;
        }
        
        // Skip elements that are too large (likely containers)
        const rect = el.getBoundingClientRect();
        if (rect.width > window.innerWidth * 0.8 || rect.height > window.innerHeight * 0.8) {
          return false;
        }
        
        const text = el.textContent || '';
        const elementText = caseSensitive ? text : text.toLowerCase();
        
        if (partial) {
          return elementText.includes(searchValue);
        } else {
          return elementText.trim() === searchValue.trim();
        }
      });
    };

    // Helper function to find elements by placeholder
    const findElementsByPlaceholder = (placeholderText: string): Element[] => {
      const searchValue = caseSensitive ? placeholderText : placeholderText.toLowerCase();
      return Array.from(document.querySelectorAll('input[placeholder], textarea[placeholder]')).filter(el => {
        const placeholder = el.getAttribute('placeholder') || '';
        const elementPlaceholder = caseSensitive ? placeholder : placeholder.toLowerCase();
        return elementPlaceholder.includes(searchValue);
      });
    };

    // Helper function to find elements by label
    const findElementsByLabel = (labelText: string): Element[] => {
      const searchValue = caseSensitive ? labelText : labelText.toLowerCase();
      const labels = Array.from(document.querySelectorAll('label')).filter(label => {
        const text = label.textContent || '';
        const elementText = caseSensitive ? text : text.toLowerCase();
        return elementText.includes(searchValue);
      });
      
      const elements: Element[] = [];
      labels.forEach(label => {
        const forAttr = label.getAttribute('for');
        if (forAttr) {
          const input = document.getElementById(forAttr);
          if (input) elements.push(input);
        } else {
          const input = label.querySelector('input, textarea, select');
          if (input) elements.push(input);
        }
      });
      
      return elements;
    };

    // Helper function to get element info
    const getElementInfo = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return {
        tagName: element.tagName,
        className: element.className,
        id: element.id,
        text: element.textContent?.trim() || '',
        value: (element as HTMLInputElement).value || '',
        placeholder: element.getAttribute('placeholder') || '',
        visible: rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden',
        position: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        },
        attributes: Array.from(element.attributes).reduce((acc, attr) => {
          acc[attr.name] = attr.value;
          return acc;
        }, {} as Record<string, string>)
      };
    };

    // Helper function to check if element is scrollable
    const isScrollable = (element: Element): boolean => {
      const style = getComputedStyle(element);
      const overflowX = style.overflowX;
      const overflowY = style.overflowY;
      const overflow = style.overflow;
      
      // Check if overflow is set to allow scrolling
      const hasScrollableOverflow = 
        overflow === 'auto' || overflow === 'scroll' ||
        overflowX === 'auto' || overflowX === 'scroll' ||
        overflowY === 'auto' || overflowY === 'scroll';
      
      // Check if content actually overflows
      const hasOverflowingContent = 
        element.scrollHeight > element.clientHeight || 
        element.scrollWidth > element.clientWidth;
      
      // Special case for body and html - they're always considered scrollable for page scrolling
      if (element.tagName === 'BODY' || element.tagName === 'HTML') {
        return true;
      }
      
      return hasScrollableOverflow && hasOverflowingContent;
    };

    // Helper function to get scroll information
    const getScrollInfo = (element?: Element) => {
      if (element) {
        return {
          scrollTop: element.scrollTop,
          scrollLeft: element.scrollLeft,
          scrollHeight: element.scrollHeight,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          clientWidth: element.clientWidth,
          canScrollVertically: element.scrollHeight > element.clientHeight,
          canScrollHorizontally: element.scrollWidth > element.clientWidth,
          isScrollable: isScrollable(element)
        };
      } else {
        // Page scroll info
        return {
          scrollTop: window.pageYOffset || document.documentElement.scrollTop,
          scrollLeft: window.pageXOffset || document.documentElement.scrollLeft,
          scrollHeight: document.documentElement.scrollHeight,
          scrollWidth: document.documentElement.scrollWidth,
          clientHeight: window.innerHeight,
          clientWidth: window.innerWidth,
          canScrollVertically: document.documentElement.scrollHeight > window.innerHeight,
          canScrollHorizontally: document.documentElement.scrollWidth > window.innerWidth,
          isScrollable: true
        };
      }
    };

    // Helper function to perform scrolling
    const performScroll = (element: Element | null, direction: string, amount: number, useSmooth: boolean) => {
      if (element) {
        // Scroll within element
        const currentScrollTop = element.scrollTop;
        const currentScrollLeft = element.scrollLeft;
        let newScrollTop = currentScrollTop;
        let newScrollLeft = currentScrollLeft;

        switch (direction) {
          case 'up':
            newScrollTop = Math.max(0, currentScrollTop - amount);
            break;
          case 'down':
            newScrollTop = Math.min(element.scrollHeight - element.clientHeight, currentScrollTop + amount);
            break;
          case 'left':
            newScrollLeft = Math.max(0, currentScrollLeft - amount);
            break;
          case 'right':
            newScrollLeft = Math.min(element.scrollWidth - element.clientWidth, currentScrollLeft + amount);
            break;
          case 'top':
            newScrollTop = 0;
            break;
          case 'bottom':
            newScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
            break;
        }

        // Always use direct property setting for more reliable scrolling
        // scrollTo() can be unreliable in some browsers/elements
        element.scrollTop = newScrollTop;
        element.scrollLeft = newScrollLeft;
        
        // If smooth scrolling is requested and scrollTo is available, try it as well
        if (useSmooth && typeof element.scrollTo === 'function') {
          try {
            element.scrollTo({
              top: newScrollTop,
              left: newScrollLeft,
              behavior: 'smooth'
            });
          } catch (e) {
            // Ignore errors, direct property setting already happened
          }
        }
      } else {
        // Scroll page
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const currentScrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollOptions: ScrollToOptions = {
          behavior: useSmooth ? 'smooth' : 'instant'
        };

        switch (direction) {
          case 'up':
            scrollOptions.top = Math.max(0, currentScrollTop - amount);
            break;
          case 'down':
            scrollOptions.top = currentScrollTop + amount;
            break;
          case 'left':
            scrollOptions.left = Math.max(0, currentScrollLeft - amount);
            break;
          case 'right':
            scrollOptions.left = currentScrollLeft + amount;
            break;
          case 'top':
            scrollOptions.top = 0;
            break;
          case 'bottom':
            scrollOptions.top = document.documentElement.scrollHeight;
            break;
        }

        window.scrollTo(scrollOptions);
      }
    };

    // Helper function to find scrollable containers
    const findScrollableContainers = (): Element[] => {
      const allElements = Array.from(document.querySelectorAll('*'));
      return allElements.filter(el => {
        // Exclude body and html from scrollable containers list
        // They should only be used for page scrolling
        if (el.tagName === 'BODY' || el.tagName === 'HTML') {
          return false;
        }
        
        const style = getComputedStyle(el);
        const overflowX = style.overflowX;
        const overflowY = style.overflowY;
        const overflow = style.overflow;
        
        // Check if overflow is set to allow scrolling
        const hasScrollableOverflow = 
          overflow === 'auto' || overflow === 'scroll' ||
          overflowX === 'auto' || overflowX === 'scroll' ||
          overflowY === 'auto' || overflowY === 'scroll';
        
        // Check if content actually overflows
        const hasOverflowingContent = 
          el.scrollHeight > el.clientHeight || 
          el.scrollWidth > el.clientWidth;
        
        // Must have both scrollable overflow AND overflowing content
        return hasScrollableOverflow && hasOverflowingContent;
      });
    };

    try {
      // Handle special actions that don't need element selection
      if (action === 'get_page_info') {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
          level: h.tagName,
          text: h.textContent?.trim() || ''
        }));
        
        const links = Array.from(document.querySelectorAll('a[href]')).map(a => ({
          text: a.textContent?.trim() || '',
          href: a.getAttribute('href') || ''
        }));
        
        const forms = Array.from(document.querySelectorAll('form')).map(form => ({
          id: form.id,
          action: form.getAttribute('action') || '',
          method: form.getAttribute('method') || 'get',
          fieldCount: form.querySelectorAll('input, textarea, select').length
        }));
        
        const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).map(btn => ({
          text: btn.textContent?.trim() || (btn as HTMLInputElement).value || '',
          type: btn.getAttribute('type') || 'button'
        }));

        return {
          success: true,
          data: {
            title: document.title,
            url: window.location.href,
            headings,
            links: links.slice(0, 20), // Limit to first 20 links
            forms,
            buttons,
            elementCounts: {
              total: document.querySelectorAll('*').length,
              inputs: document.querySelectorAll('input').length,
              buttons: document.querySelectorAll('button').length,
              links: document.querySelectorAll('a').length
            }
          }
        };
      }

      if (action === 'get_form') {
        const forms = Array.from(document.querySelectorAll('form'));
        if (forms.length === 0) {
          return {
            success: false,
            error: "No forms found on the page"
          };
        }

        const formData = forms.map(form => {
          const fields = Array.from(form.querySelectorAll('input, textarea, select')).map(field => {
            const input = field as HTMLInputElement;
            return {
              name: input.name || input.id || '',
              type: input.type || 'text',
              value: input.value || '',
              placeholder: input.placeholder || '',
              required: input.required,
              label: (() => {
                const label = form.querySelector(`label[for="${input.id}"]`) || 
                             input.closest('label');
                return label?.textContent?.trim() || '';
              })()
            };
          });

          return {
            id: form.id,
            action: form.getAttribute('action') || '',
            method: form.getAttribute('method') || 'get',
            fields
          };
        });

        return {
          success: true,
          data: { forms: formData }
        };
      }

      // Handle scroll actions that don't need element selection
      if (action === 'scroll_page') {
        if (!scrollDirection) {
          return {
            success: false,
            error: "scrollDirection is required for scroll_page action. Use: up, down, left, right, top, bottom"
          };
        }

        const pageAmount = scrollDirection === 'up' || scrollDirection === 'down' ? 
          (scrollAmount === 300 ? window.innerHeight : scrollAmount) : scrollAmount;
        
        performScroll(null, scrollDirection, pageAmount, smooth);
        
        return {
          success: true,
          data: {
            scrolled: true,
            direction: scrollDirection,
            amount: pageAmount,
            smooth,
            newScrollInfo: getScrollInfo()
          }
        };
      }

      if (action === 'get_scroll_info' && !selector && !textContent && !partialText && !placeholder && !label) {
        // Get page scroll info when no element specified
        const pageScrollInfo = getScrollInfo();
        const scrollableContainers = findScrollableContainers().slice(0, 10).map(el => ({
          ...getElementInfo(el),
          scrollInfo: getScrollInfo(el)
        }));
        
        return {
          success: true,
          data: {
            page: pageScrollInfo,
            scrollableContainers
          }
        };
      }

      // Find elements based on search criteria
      let elements: Element[] = [];

      if (selector) {
        // Validate CSS selector
        try {
          elements = Array.from(document.querySelectorAll(selector));
        } catch (e) {
          return {
            success: false,
            error: `Invalid CSS selector '${selector}'. CSS selectors like ':contains()' are not supported. Use 'textContent' parameter instead.`
          };
        }
      } else if (textContent) {
        elements = findElementsByText(textContent, false);
      } else if (partialText) {
        elements = findElementsByText(partialText, true);
      } else if (placeholder) {
        elements = findElementsByPlaceholder(placeholder);
      } else if (label) {
        elements = findElementsByLabel(label);
      } else {
        return {
          success: false,
          error: "Must provide either 'selector', 'textContent', 'partialText', 'placeholder', or 'label' parameter"
        };
      }

      // Handle find_all action
      if (action === 'find_all') {
        return {
          success: true,
          data: {
            count: elements.length,
            elements: elements.slice(0, 50).map(getElementInfo) // Limit to 50 elements
          }
        };
      }

      // For other actions, select specific element
      if (elements.length === 0) {
        return {
          success: false,
          error: "No elements found matching the criteria"
        };
      }

      if (index >= elements.length) {
        return {
          success: false,
          error: `Index ${index} out of range. Found ${elements.length} elements (0-${elements.length - 1})`
        };
      }

      const element = elements[index];

      switch (action) {
        case 'exists':
          return {
            success: true,
            data: { 
              exists: true, 
              count: elements.length,
              selectedIndex: index
            }
          };

        case 'query':
          return {
            success: true,
            data: {
              ...getElementInfo(element),
              totalFound: elements.length,
              selectedIndex: index
            }
          };

        case 'click':
          (element as HTMLElement).click();
          return {
            success: true,
            data: { 
              clicked: true, 
              element: getElementInfo(element),
              totalFound: elements.length
            }
          };

        case 'text':
          return {
            success: true,
            data: { 
              text: element.textContent || "",
              innerText: (element as HTMLElement).innerText || "",
              element: getElementInfo(element)
            }
          };

        case 'value':
          if (value !== undefined) {
            // Set value
            (element as HTMLInputElement).value = value;
            // Trigger change event
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('input', { bubbles: true }));
            return {
              success: true,
              data: { 
                valueSet: true,
                newValue: value,
                element: getElementInfo(element)
              }
            };
          } else {
            // Get value
            return {
              success: true,
              data: { 
                value: (element as HTMLInputElement).value || "",
                element: getElementInfo(element)
              }
            };
          }

        case 'get_scroll_info':
          // Get scroll info for page or specific element
          if (elements.length > 0) {
            const scrollInfo = getScrollInfo(element);
            return {
              success: true,
              data: {
                ...scrollInfo,
                element: getElementInfo(element)
              }
            };
          } else {
            // Get page scroll info
            const pageScrollInfo = getScrollInfo();
            const scrollableContainers = findScrollableContainers().slice(0, 10).map(el => ({
              ...getElementInfo(el),
              scrollInfo: getScrollInfo(el)
            }));
            
            return {
              success: true,
              data: {
                page: pageScrollInfo,
                scrollableContainers
              }
            };
          }

        case 'scroll_page':
          if (!scrollDirection) {
            return {
              success: false,
              error: "scrollDirection is required for scroll_page action. Use: up, down, left, right, top, bottom"
            };
          }

          const pageAmount = scrollDirection === 'up' || scrollDirection === 'down' ? 
            (scrollAmount === 300 ? window.innerHeight : scrollAmount) : scrollAmount;
          
          performScroll(null, scrollDirection, pageAmount, smooth);
          
          return {
            success: true,
            data: {
              scrolled: true,
              direction: scrollDirection,
              amount: pageAmount,
              smooth,
              newScrollInfo: getScrollInfo()
            }
          };

        case 'scroll_to_element':
          // Scroll element into view
          element.scrollIntoView({
            behavior: smooth ? 'smooth' : 'instant',
            block: 'center',
            inline: 'center'
          });
          
          return {
            success: true,
            data: {
              scrolledToElement: true,
              element: getElementInfo(element),
              smooth
            }
          };

        case 'scroll_in_element':
          if (!scrollDirection) {
            return {
              success: false,
              error: "scrollDirection is required for scroll_in_element action. Use: up, down, left, right, top, bottom"
            };
          }

          if (!isScrollable(element)) {
            return {
              success: false,
              error: "Selected element is not scrollable"
            };
          }

          const beforeScrollInfo = getScrollInfo(element);
          performScroll(element, scrollDirection, scrollAmount, smooth);
          const afterScrollInfo = getScrollInfo(element);
          
          return {
            success: true,
            data: {
              scrolled: true,
              direction: scrollDirection,
              amount: scrollAmount,
              smooth,
              element: getElementInfo(element),
              beforeScroll: beforeScrollInfo,
              afterScroll: afterScrollInfo
            }
          };

        case 'innerHTML':
          if (innerHTML !== undefined) {
            // Set innerHTML
            const previousHTML = element.innerHTML;
            
            // Basic safety validation - prevent obviously dangerous content
            if (innerHTML.includes('<script') || innerHTML.includes('javascript:') || innerHTML.includes('onload=') || innerHTML.includes('onerror=')) {
              return {
                success: false,
                error: "HTML content contains potentially unsafe elements (script tags, javascript: URLs, or event handlers). For security reasons, this content cannot be set."
              };
            }
            
            try {
              element.innerHTML = innerHTML;
              
              // Trigger DOM mutation events
              element.dispatchEvent(new Event('DOMSubtreeModified', { bubbles: true }));
              
              return {
                success: true,
                data: { 
                  htmlSet: true,
                  newHTML: innerHTML,
                  previousHTML: previousHTML,
                  element: getElementInfo(element),
                  warning: "innerHTML has been set. Be aware that this can affect page functionality and styling."
                }
              };
            } catch (e) {
              return {
                success: false,
                error: `Failed to set innerHTML: ${e instanceof Error ? e.message : 'Unknown error'}`
              };
            }
          } else {
            // Get innerHTML
            return {
              success: true,
              data: { 
                innerHTML: element.innerHTML,
                element: getElementInfo(element)
              }
            };
          }

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
  'Enhanced DOM Element Interaction'
);

/**
 * Enhanced Browser Storage Tool
 */
export const browserStorageTool = createTool(
  'browser_storage',
  'Save and retrieve data in browser storage. Use this to: REMEMBER user preferences, STORE temporary data, SAVE form data, PERSIST settings between sessions. Actions: "set" to save data, "get" to retrieve data, "remove" to delete data, "clear" to delete all data, "keys" to list all stored keys. Perfect for: remembering user choices, saving progress, storing configuration.',
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
  'Discover available tools and their capabilities. Use this when users ask "what can you do?", "what tools do you have?", or "what are your capabilities?". Returns a complete list of all available tools with descriptions and usage examples. Essential for understanding what actions are possible.',
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
