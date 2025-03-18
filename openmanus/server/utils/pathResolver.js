const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Resolve the path to the Python executable
 * @returns {Promise<string>} Path to the Python executable
 */
async function resolvePythonPath() {
  try {
    // First, try to use PYTHON_PATH from environment
    if (process.env.PYTHON_PATH) {
      if (fs.existsSync(process.env.PYTHON_PATH)) {
        return process.env.PYTHON_PATH;
      }
      console.warn(`PYTHON_PATH environment variable is set but file does not exist: ${process.env.PYTHON_PATH}`);
    }

    // Next, try to find Python in path using 'where' (Windows) or 'which' (UNIX)
    try {
      const command = process.platform === 'win32' ? 'where python' : 'which python3';
      const { stdout } = await execAsync(command);
      const pythonPath = stdout.trim().split('\n')[0]; // Take the first result

      if (pythonPath && fs.existsSync(pythonPath)) {
        return pythonPath;
      }
    } catch (error) {
      console.warn(`Could not find Python in PATH: ${error.message}`);
    }

    // Default to standard paths based on OS
    const defaultPaths = process.platform === 'win32'
      ? [
        'C:\\Python310\\python.exe',
        'C:\\Python39\\python.exe',
        'C:\\Python38\\python.exe',
        'C:\\Python37\\python.exe',
        'C:\\Python36\\python.exe',
        process.env.LOCALAPPDATA + '\\Programs\\Python\\Python310\\python.exe',
        process.env.LOCALAPPDATA + '\\Programs\\Python\\Python39\\python.exe',
        process.env.LOCALAPPDATA + '\\Programs\\Python\\Python38\\python.exe'
      ]
      : [
        '/usr/bin/python3',
        '/usr/local/bin/python3',
        '/opt/homebrew/bin/python3'
      ];

    for (const path of defaultPaths) {
      if (fs.existsSync(path)) {
        return path;
      }
    }

    throw new Error('Python executable not found. Set PYTHON_PATH environment variable.');
  } catch (error) {
    console.error('Error resolving Python path:', error);
    throw error;
  }
}

/**
 * Resolve the path to a Python script
 * @param {string} [scriptName] - Optional script name, defaults to run_flow.py
 * @returns {Promise<string>} Path to the script
 */
async function resolveScriptPath(scriptName = 'run_flow.py') {
  try {
    // First, try to use the environment variable
    if (process.env.FLOW_SCRIPT_PATH) {
      const envPath = process.env.FLOW_SCRIPT_PATH;
      // Check if path is absolute
      if (path.isAbsolute(envPath)) {
        if (fs.existsSync(envPath)) {
          return envPath;
        }
        console.warn(`FLOW_SCRIPT_PATH environment variable is set but file does not exist: ${envPath}`);
      } else {
        // Try different combinations with the relative path
        const possiblePaths = [
          path.join(process.cwd(), envPath),
          path.join(process.cwd(), '..', envPath),
          // Remove the ./ prefix if it exists
          path.join(process.cwd(), envPath.replace(/^\.\//g, '')),
          path.join(process.cwd(), '..', envPath.replace(/^\.\//g, ''))
        ];
        
        for (const possiblePath of possiblePaths) {
          if (fs.existsSync(possiblePath)) {
            return possiblePath;
          }
        }
        console.warn(`FLOW_SCRIPT_PATH environment variable is set but file does not exist at resolved paths`);
      }
    }

    // Then try standard script locations
    const potentialPaths = [
      // Script is in current directory
      path.join(process.cwd(), scriptName),
      
      // Script is in parent directory
      path.join(process.cwd(), '..', scriptName),
      
      // Python directory
      path.join(process.cwd(), 'python', scriptName),

      // Server/python directory
      path.join(process.cwd(), 'server', 'python', scriptName),

      // Parent directory
      path.join(process.cwd(), '..', scriptName),

      // Parent's python directory
      path.join(process.cwd(), '..', 'python', scriptName),

      // Workspace directory
      path.join(process.cwd(), 'workspace', scriptName),

      // A more complicated relative path
      path.join(process.cwd(), '..', 'pythagora-core', 'workspace', 'openmanus', scriptName),
      
      // Openmanus-specific paths
      path.join(process.cwd(), 'openmanus', scriptName),
      path.join(process.cwd(), '..', 'openmanus', scriptName),
      path.resolve(process.cwd(), '..', 'openmanus', scriptName),
      path.resolve(process.cwd(), 'openmanus', scriptName),
    ];

    for (const scriptPath of potentialPaths) {
      if (fs.existsSync(scriptPath)) {
        console.log(`Found flow script at path: ${scriptPath}`);
        return scriptPath;
      }
    }

    throw new Error(`Script "${scriptName}" not found. Set FLOW_SCRIPT_PATH environment variable.`);
  } catch (error) {
    console.error('Error resolving script path:', error);
    throw error;
  }
}

/**
 * Resolve the path to the workspace directory
 * @returns {Promise<string>} Path to the workspace directory
 */
async function resolveWorkspacePath() {
  try {
    // First, try to use WORKSPACE_DIR from environment
    if (process.env.WORKSPACE_DIR) {
      if (fs.existsSync(process.env.WORKSPACE_DIR)) {
        return process.env.WORKSPACE_DIR;
      }
      console.warn(`WORKSPACE_DIR environment variable is set but directory does not exist: ${process.env.WORKSPACE_DIR}`);
    }

    // Then try standard workspace locations
    const potentialPaths = [
      // Main workspace directory
      path.join(process.cwd(), 'workspace'),

      // Server workspace directory
      path.join(process.cwd(), 'server', 'workspace'),

      // Parent workspace directory
      path.join(process.cwd(), '..', 'workspace'),
    ];

    for (const workspacePath of potentialPaths) {
      if (fs.existsSync(workspacePath)) {
        return workspacePath;
      }
    }

    // Create a default workspace directory if none exists
    const defaultWorkspace = path.join(process.cwd(), 'workspace');
    fs.mkdirSync(defaultWorkspace, { recursive: true });
    return defaultWorkspace;
  } catch (error) {
    console.error('Error resolving workspace path:', error);
    throw error;
  }
}

module.exports = {
  resolvePythonPath,
  resolveScriptPath,
  resolveWorkspacePath
};