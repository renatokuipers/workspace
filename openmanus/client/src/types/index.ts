// openmanus/client/src/types/index.ts
export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  isEditing?: boolean;
}

export interface Tool {
  id: string;
  name: string;
  type: 'code' | 'terminal' | 'browser';
}

export interface TabState {
  id: string;
  type: 'code' | 'terminal' | 'browser';
  title: string;
  active: boolean;
}

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  children?: FileNode[];
}

export interface ToolsState {
  codeEditorContent: string;
  terminalHistory: string[];
  terminalOutput: string[];
  browserUrl: string;
  chatMessages: ChatMessage[];
}