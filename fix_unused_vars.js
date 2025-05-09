const fs = require('fs');
const path = require('path');

// Function to recursively find files
function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else if (f.endsWith('.js')) {
      callback(path.join(dir, f));
    }
  });
}

// Function to fix unused variables in a file
function fixUnusedVarsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Find and replace patterns for parameter declarations - add underscore prefix to unused parameters
  const paramRegexPatterns = [
    // Regular function declaration parameters
    /(function\s+\w+\s*\()([^)]*\b)(coordinate|fromProjection|toProjection|options|params|container|cursorType|zoomLevel|marker|polyline|polygon|eventType|listener|listenerHandle|pixel|coordinates|angle|position|model|factor|renderedFeature|event|error|index|targetPoint)(\b[^)]*\))/g,
    
    // Arrow function parameters
    /(\([^)]*\b)(coordinate|fromProjection|toProjection|options|params|container|cursorType|zoomLevel|marker|polyline|polygon|eventType|listener|listenerHandle|pixel|coordinates|angle|position|model|factor|renderedFeature|event|error|index|targetPoint)(\b[^)]*\))/g,
    
    // Method declaration parameters
    /([\w.]+\s*\()([^)]*\b)(coordinate|fromProjection|toProjection|options|params|container|cursorType|zoomLevel|marker|polyline|polygon|eventType|listener|listenerHandle|pixel|coordinates|angle|position|model|factor|renderedFeature|event|error|index|targetPoint)(\b[^)]*\))/g
  ];

  // Find and replace patterns for variable declarations - add underscore prefix to unused variables
  const varRegexPatterns = [
    // const/let/var
    /(const|let|var)\s+(\b)(R|Coordinate|MapInterface|LineFeature|PolygonFeature|elevation|gnssModule|targetPoint)(\b)/g
  ];

  // Apply all regex patterns
  for (const regex of paramRegexPatterns) {
    const newContent = content.replace(regex, (match, before, params, varName, after) => {
      // Only add underscore if the parameter name doesn't already have one
      if (!params.includes('_' + varName)) {
        modified = true;
        return before + params.replace(new RegExp('\\b' + varName + '\\b'), '_' + varName) + after;
      }
      return match;
    });
    if (newContent !== content) {
      content = newContent;
    }
  }

  for (const regex of varRegexPatterns) {
    const newContent = content.replace(regex, (match, declarationType, before, varName, after) => {
      // Only add underscore if the variable name doesn't already have one
      if (!before.includes('_' + varName)) {
        modified = true;
        return declarationType + ' ' + before + '_' + varName + after;
      }
      return match;
    });
    if (newContent !== content) {
      content = newContent;
    }
  }

  // Save the file if it was modified
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

// Run the fix on all JavaScript files in src directory
walkDir(path.join(__dirname, 'src'), fixUnusedVarsInFile);
console.log('Completed unused variable fixes');