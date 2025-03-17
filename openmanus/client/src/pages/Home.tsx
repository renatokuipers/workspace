// openmanus/client/src/pages/Home.tsx  
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChatMessage } from '@/components/Chat/ChatMessage';
import { ChatInput } from '@/components/Chat/ChatInput';
import { CodeEditor } from '@/components/Tools/CodeEditor';
import { Terminal } from '@/components/Tools/Terminal';
import { Browser } from '@/components/Tools/Browser';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage as IChatMessage } from '@/types';
import { getChatHistory, sendMessage, editMessage, deleteMessage } from '@/api/chat';
import { RootState } from '@/store';
import {
  updateCodeEditor,
  updateBrowserUrl,
  addChatMessage,
  updateChatMessage,
  deleteChatMessage,
  setChatMessages
} from '@/store/slices/toolsSlice';
import { useToast } from '@/hooks/useToast';

interface TabState {
  id: string;
  type: 'code' | 'terminal' | 'browser';
  title: string;
  active: boolean;
}

export function Home() {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const { codeEditorContent, browserUrl, chatMessages } = useSelector((state: RootState) => state.tools);
  const [isLoading, setIsLoading] = useState(false);
  const [tabs] = useState<TabState[]>([
    { id: 'code', type: 'code', title: 'Code Editor', active: true },
    { id: 'terminal', type: 'terminal', title: 'Terminal', active: false },
    { id: 'browser', type: 'browser', title: 'Browser', active: false },
  ]);

  useEffect(() => {
    const loadInitialData = async () => {
      if (chatMessages.length === 0) {
        try {
          const { messages } = await getChatHistory();
          dispatch(setChatMessages(messages));
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to load chat history"
          });
        }
      }
    };
    loadInitialData();
  }, [dispatch, toast, chatMessages.length]);

  const handleSendMessage = async (content: string) => {
    const userMessage: IChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      content,
      role: 'user',
      timestamp: new Date().toISOString()
    };

    dispatch(addChatMessage(userMessage));
    setIsLoading(true);

    try {
      const response = await sendMessage(content);
      dispatch(addChatMessage(response as IChatMessage));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    // Start loading state to prevent further interactions
    setIsLoading(true);
    
    try {
      // Step 1: Find the message and its position before making any changes
      const messageIndex = chatMessages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) {
        throw new Error("Message not found");
      }

      // Step 2: Create updated message object
      const updatedMessage = {
        ...chatMessages[messageIndex],
        content: newContent
      };
      
      // Step 3: First send edit to backend, so we can catch errors early
      const editSuccess = await editMessage(messageId, newContent);
      if (!editSuccess) {
        throw new Error("API failed to update message");
      }
      
      // Step 4: Update Redux state - only keep messages up to the edited one
      const updatedMessages = [
        ...chatMessages.slice(0, messageIndex),
        updatedMessage
      ];
      dispatch(setChatMessages(updatedMessages));
      
      // Step 5: Generate a new AI response based on edited content
      const response = await sendMessage(newContent);
      if (!response) {
        throw new Error("Failed to generate new response");
      }
      
      // Step 6: Add the new response to chat history
      dispatch(addChatMessage(response as IChatMessage));
      
      // Success notification only if everything worked
      toast({
        title: "Success",
        description: "Message updated and new response generated"
      });
      
    } catch (error: any) {
      // Detailed error notification
      toast({
        variant: "destructive",
        title: "Edit Failed",
        description: error.message || "Failed to edit message"
      });
      
      // Could add rollback logic here if needed to undo partial changes
      
    } finally {
      // Always reset loading state
      setIsLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    setIsLoading(true);
    try {
      // Step 1: Find the message first to confirm it exists
      const messageIndex = chatMessages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) {
        throw new Error("Message not found");
      }
      
      // Step 2: Call API to delete the message
      const deleteSuccess = await deleteMessage(messageId);
      if (!deleteSuccess) {
        throw new Error("API failed to delete message");
      }
      
      // Step 3: Only after successful API call, update Redux state
      // Remove the deleted message and all following messages
      dispatch(setChatMessages(chatMessages.slice(0, messageIndex)));

      toast({
        title: "Success",
        description: "Message deleted successfully"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: error.message || "Failed to delete message"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (value: string | undefined) => {
    dispatch(updateCodeEditor(value || ''));
  };

  const handleBrowserNavigate = (url: string) => {
    dispatch(updateBrowserUrl(url));
  };

  return (
    <div className="h-[calc(100vh-8rem)]">
      <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border">
        <ResizablePanel defaultSize={40} minSize={30}>
          <div className="h-full flex flex-col">
            <ScrollArea className="flex-1">
              {chatMessages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                />
              ))}
            </ScrollArea>
            <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={60}>
          <Tabs defaultValue="code" className="h-full">
            <TabsList className="w-full justify-start">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.title}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="code" className="h-[calc(100%-40px)]">
              <CodeEditor value={codeEditorContent} onChange={handleCodeChange} />
            </TabsContent>
            <TabsContent value="terminal" className="h-[calc(100%-40px)]">
              <Terminal />
            </TabsContent>
            <TabsContent value="browser" className="h-[calc(100%-40px)]">
              <Browser url={browserUrl} onNavigate={handleBrowserNavigate} />
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}