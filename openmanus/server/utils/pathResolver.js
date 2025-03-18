const path = require('path');
const fs = require('fs');

/**
 * Resolves the path to the OpenManus run_flow.py script
 * Tries multiple possible locations to find the script
 */
function resolveFlowScriptPath() {
  // Use environment variable if specified and exists
  const envPath = process.env.FLOW_SCRIPT_PATH;
  if (envPath && fs.existsSync(envPath)) {
    console.log(`Found flow script at environment path: ${envPath}`);
    return envPath;
  }

  // Try common relative paths from project root
  const possiblePaths = [
    // Direct relative paths from project root
    path.join(__dirname, '../../openmanus/run_flow.py'),
    path.join(__dirname, '../../../openmanus/run_flow.py'),
    // Node modules path (if installed as package)
    path.join(__dirname, '../../node_modules/openmanus/run_flow.py'),
    // Current directory
    path.join(process.cwd(), 'openmanus/run_flow.py'),
    // Parent directory
    path.join(process.cwd(), '../openmanus/run_flow.py'),
  ];

  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      console.log(`Found flow script at: ${testPath}`);
      return testPath;
    }
  }

  // If we haven't found it yet, report all attempted paths
  console.error('Could not find run_flow.py script at any of these locations:');
  possiblePaths.forEach(p => console.error(`- ${p}`));

  if (envPath) {
    console.error(`- ${envPath} (from FLOW_SCRIPT_PATH environment variable)`);
  }

  // Fall back to the environment variable even if it doesn't exist
  // This will likely fail but will produce a clearer error message
  return envPath || path.join(__dirname, '../../openmanus/run_flow.py');
}

/**
 * Resolves the path to the Python executable
 * Handles both system Python and virtual environments
 */
function resolvePythonExecutable() {
  const useVirtualEnv = process.env.USE_PYTHON_VENV === 'true';
  const virtualEnvPath = process.env.PYTHON_VENV_PATH || path.join(__dirname, '../../../venv');

  if (useVirtualEnv) {
    // Determine platform-specific path to Python in virtual environment
    const venvPythonPath = process.platform === 'win32'
      ? path.join(virtualEnvPath, 'Scripts', 'python.exe')
      : path.join(virtualEnvPath, 'bin', 'python');

    if (fs.existsSync(venvPythonPath)) {
      console.log(`Using Python from virtual environment: ${venvPythonPath}`);
      return venvPythonPath;
    }

    console.warn(`Virtual environment not found at ${virtualEnvPath}, falling back to system Python`);
  }

  return process.env.PYTHON_PATH || 'python';
}

module.exports = {
  resolveFlowScriptPath,
  resolvePythonExecutable
};