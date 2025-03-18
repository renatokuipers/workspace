/**
 * Message protocol utility for communication with Python processes
 */

// Message types for communication with Python processes
const MESSAGE_TYPES = {
  // System-level messages
  SYSTEM: 'system',
  ERROR: 'error',
  LOG: 'log',
  STATUS: 'status',
  
  // User interactions
  USER_INPUT: 'user_input',
  
  // Flow execution messages
  FLOW: 'flow',
  EXECUTION: 'execution',
  RESULT: 'result',
  
  // Tool-related messages
  TOOL_CALL: 'tool_call',
  TOOL_RESULT: 'tool_result'
};

const MAX_CHUNK_SIZE = 16384; // 16KB per chunk

/**
 * Parse a message from the Python process
 * @param {string} messageStr - The message string to parse
 * @returns {Object|null} The parsed message or null if parsing failed
 */
function parseMessage(messageStr) {
  try {
    // Try to parse as JSON
    const parsed = JSON.parse(messageStr);
    
    // Validate message structure
    if (!parsed.type) {
      console.warn('Message missing required type field:', messageStr);
      return null;
    }
    
    return parsed;
  } catch (error) {
    // Not valid JSON, might be regular output
    return null;
  }
}

/**
 * Create a message to send to the Python process
 * @param {string} type - The message type from MESSAGE_TYPES
 * @param {Object} payload - The message payload
 * @returns {string} The stringified message
 */
function createMessage(type, payload) {
  if (!Object.values(MESSAGE_TYPES).includes(type)) {
    console.warn(`Warning: Unknown message type '${type}'`);
  }
  
  return JSON.stringify({
    type,
    payload,
    timestamp: new Date().toISOString()
  });
}

function createChunkedMessage(type, payload) {
  const fullMessage = { type, payload, timestamp: Date.now() };
  const fullMessageStr = JSON.stringify(fullMessage);

  // If message is small enough, send as is
  if (fullMessageStr.length <= MAX_CHUNK_SIZE) {
    return [fullMessageStr];
  }

  // For larger messages, create chunks
  const messageId = Date.now() + Math.random().toString(36).substring(2, 15);
  const payloadStr = JSON.stringify(payload);
  const chunks = [];

  // Split the payload into chunks
  for (let i = 0; i < payloadStr.length; i += MAX_CHUNK_SIZE) {
    const chunkPayload = payloadStr.substring(i, i + MAX_CHUNK_SIZE);
    const chunkIndex = Math.floor(i / MAX_CHUNK_SIZE);
    const totalChunks = Math.ceil(payloadStr.length / MAX_CHUNK_SIZE);

    const chunk = {
      type: `${type}_CHUNK`,
      chunkId: messageId,
      chunkIndex,
      totalChunks,
      chunk: chunkPayload,
      timestamp: Date.now()
    };

    chunks.push(JSON.stringify(chunk));
  }

  return chunks;
}

function assembleChunks(chunks) {
  if (!chunks || chunks.length === 0) return null;

  // Sort chunks by index
  chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

  // Check if we have all chunks
  const totalChunks = chunks[0].totalChunks;
  if (chunks.length !== totalChunks) return null;

  // Assemble the payload
  const payloadStr = chunks.map(c => c.chunk).join('');

  try {
    const payload = JSON.parse(payloadStr);
    return {
      type: chunks[0].type.replace('_CHUNK', ''),
      payload,
      timestamp: chunks[0].timestamp
    };
  } catch (error) {
    console.error('Error assembling chunks:', error);
    return null;
  }
}

module.exports = {
  MESSAGE_TYPES,
  parseMessage,
  createMessage,
  createChunkedMessage,
  assembleChunks
};