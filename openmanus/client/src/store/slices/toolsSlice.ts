// openmanus/client/src/store/slices/toolsSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ToolsState, ChatMessage } from '@/types';

const initialState: ToolsState = {
  codeEditorContent: '// Start coding here...',
  terminalHistory: [],
  terminalOutput: [],
  browserUrl: 'https://example.com',
  chatMessages: []
};

const toolsSlice = createSlice({
  name: 'tools',
  initialState,
  reducers: {
    updateCodeEditor: (state, action: PayloadAction<string>) => {
      state.codeEditorContent = action.payload;
    },
    addTerminalCommand: (state, action: PayloadAction<string>) => {
      state.terminalHistory.push(action.payload);
    },
    addTerminalOutput: (state, action: PayloadAction<string>) => {
      state.terminalOutput.push(action.payload);
    },
    updateBrowserUrl: (state, action: PayloadAction<string>) => {
      state.browserUrl = action.payload;
    },
    addChatMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.chatMessages = [...state.chatMessages, action.payload];
    },
    updateChatMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.chatMessages = state.chatMessages.map(msg =>
        msg.id === action.payload.id ? action.payload : msg
      );
    },
    deleteChatMessage: (state, action: PayloadAction<string>) => {
      state.chatMessages = state.chatMessages.filter(msg => msg.id !== action.payload);
    },
    setChatMessages: (state, action: PayloadAction<ChatMessage[]>) => {
      state.chatMessages = action.payload;
    },
    clearChatMessages: (state) => {
      state.chatMessages = [];
    }
  }
});

export const {
  updateCodeEditor,
  addTerminalCommand,
  addTerminalOutput,
  updateBrowserUrl,
  addChatMessage,
  updateChatMessage,
  deleteChatMessage,
  setChatMessages,
  clearChatMessages
} = toolsSlice.actions;

export default toolsSlice.reducer;