# MCP Browser Agent - Spring Cleaning Plan

## 🗑️ Files to Remove
- `test-sqrt.js` - Legacy test file, functionality integrated into main codebase

## 🔧 Backend Cleanup (backend/index.js)
- Remove legacy prompt-based message handling (lines 49-67)
- Remove `extractJSONFromText` function (lines 15-42)
- Remove legacy JSON parsing and fallback logic
- Simplify error responses to remove legacy fallback format

## 📝 README Updates
- Strengthen MCP protocol claims with accurate technical details
- Highlight browser-native MCP innovation
- Update architecture section to emphasize MCP compliance
- Clarify transport mechanism as innovative MCP implementation

## 🎯 Expected Benefits
- Reduce backend complexity by ~40%
- Remove 100+ lines of unused code
- Eliminate confusing dual code paths
- Improve maintainability
- More accurate technical documentation
