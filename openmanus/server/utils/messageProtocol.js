const MESSAGE_TYPES = {
  SYSTEM: 'system',
  FLOW: 'flow',
  EXECUTION: 'execution',
  STATUS: 'status',
  ERROR: 'error',
  LOG: 'log'
};

const MAX_CHUNK_SIZE = 16384; // 16KB per chunk

function createMessage(type, payload) {
  return JSON.stringify({
    type,
    payload,
    timestamp: Date.now()
  }) + '\n';
}

function parseMessage(message) {
  try {
    return JSON.parse(message);
  } catch (error) {
    console.error('Error parsing message:', error);
    console.error('Message content:', message);
    return null;
  }
}

function createChunkedMessage(type, payload) {
  const fullMessage = { type, payload, timestamp: Date.now() };
  const fullMessageStr = JSON.stringify(fullMessage);

  // If message is small enough, send as is
  if (fullMessageStr.length <= MAX_CHUNK_SIZE) {
    return [fullMessageStr + '\n'];
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

    chunks.push(JSON.stringify(chunk) + '\n');
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
  createMessage,
  parseMessage,
  createChunkedMessage,
  assembleChunks
};