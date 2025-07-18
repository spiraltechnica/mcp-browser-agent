// Test the sqrt functionality
class SafeMathEvaluator {
  constructor() {
    this.allowedChars = /^[0-9+\-*/().\s^a-zA-Z]+$/;
  }
  
  evaluate(expression) {
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
  
  processSqrtFunction(expression) {
    // Handle sqrt function by converting sqrt(x) to Math.sqrt(x)
    // Use a simpler approach with recursive replacement
    let processed = expression;
    
    // Keep replacing sqrt functions until none are left
    while (processed.includes('sqrt(')) {
      // Find the first sqrt function
      const sqrtIndex = processed.indexOf('sqrt(');
      if (sqrtIndex === -1) break;
      
      const openParenIndex = sqrtIndex + 4; // 'sqrt'.length
      
      // Find the matching closing parenthesis
      let parenCount = 1;
      let endIndex = openParenIndex + 1;
      
      while (endIndex < processed.length && parenCount > 0) {
        if (processed[endIndex] === '(') parenCount++;
        if (processed[endIndex] === ')') parenCount--;
        endIndex++;
      }
      
      if (parenCount !== 0) {
        throw new Error('Unbalanced parentheses in sqrt function');
      }
      
      // Extract the argument inside sqrt()
      const argument = processed.substring(openParenIndex + 1, endIndex - 1);
      
      // Replace sqrt(arg) with Math.sqrt(arg)
      const replacement = `Math.sqrt(${argument})`;
      processed = processed.substring(0, sqrtIndex) + replacement + processed.substring(endIndex);
    }
    
    return processed;
  }
}

// Test cases
const evaluator = new SafeMathEvaluator();

const testCases = [
  { expr: 'sqrt(16)', expected: 4 },
  { expr: 'sqrt(25)', expected: 5 },
  { expr: 'sqrt(2 + 7)', expected: 3 },
  { expr: '2 * sqrt(25)', expected: 10 },
  { expr: 'sqrt(sqrt(256))', expected: 4 },
  { expr: 'sqrt(20)', expected: Math.sqrt(20) },
  { expr: '10 + sqrt(9)', expected: 13 }
];

console.log('Testing sqrt functionality:');
console.log('========================');

testCases.forEach((test, index) => {
  try {
    const result = evaluator.evaluate(test.expr);
    const passed = Math.abs(result - test.expected) < 0.0001;
    console.log(`Test ${index + 1}: ${test.expr} = ${result} (expected: ${test.expected}) ${passed ? '✅' : '❌'}`);
  } catch (error) {
    console.log(`Test ${index + 1}: ${test.expr} = ERROR: ${error.message} ❌`);
  }
});

// Test error cases
console.log('\nTesting error cases:');
console.log('===================');

const errorCases = [
  'sqrt(-1)',
  'sqrt(',
  'sqrt(16',
  'sqrt)'
];

errorCases.forEach((test, index) => {
  try {
    const result = evaluator.evaluate(test);
    console.log(`Error Test ${index + 1}: ${test} = ${result} (should have failed) ❌`);
  } catch (error) {
    console.log(`Error Test ${index + 1}: ${test} = ERROR: ${error.message} ✅`);
  }
});
