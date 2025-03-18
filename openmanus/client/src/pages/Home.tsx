// openmanus/client/src/pages/Home.tsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChatMessage } from '@/components/Chat/ChatMessage';
import { ChatInput } from '@/components/Chat/ChatInput';
import { CodeEditor } from '@/components/Tools/CodeEditor';
import { Terminal } from '@/components/Tools/Terminal';
import { Browser } from '@/components/Tools/Browser';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage as IChatMessage } from '@/types';
import { getChatHistory, sendMessage, editMessage, deleteMessage } from '@/api/chat';
import { getProjectChat } from '@/api/projects';
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
  const { projectId } = useParams();
  const navigate = useNavigate();
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
    loadProjectChat();
  }, [projectId]);

  const loadProjectChat = async () => {
    if (!projectId) return;
    try {
      const { messages } = await getProjectChat(projectId);
      dispatch(setChatMessages(messages));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load chat history"
      });
    }
  };

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
    setIsLoading(true);
    try {
      const editSuccess = await editMessage(messageId, newContent);
      if (!editSuccess) {
        throw new Error("API failed to update message");
      }

      const updatedMessages = chatMessages.map(msg =>
        msg.id === messageId
          ? { ...msg, content: newContent }
          : msg
      );
      dispatch(setChatMessages(updatedMessages));

      const response = await sendMessage(newContent);
      if (response) {
        dispatch(addChatMessage(response as IChatMessage));
      }

      toast({
        title: "Success",
        description: "Message updated successfully"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Edit Failed",
        description: error.message || "Failed to edit message"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    setIsLoading(true);
    try {
      const deleteSuccess = await deleteMessage(messageId);
      if (!deleteSuccess) {
        throw new Error("API failed to delete message");
      }

      dispatch(deleteChatMessage(messageId));
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
    <div className="flex flex-col h-[calc(100vh-5rem)] pb-4">
      <div className="mb-4 flex items-center px-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Projects
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border mx-4">
          <ResizablePanel defaultSize={40} minSize={30}>
            <div className="h-full flex flex-col">
              <ScrollArea className="flex-1 px-4">
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
            <Tabs defaultValue="code" className="h-full flex flex-col">
              <TabsList className="w-full justify-start px-4 py-2">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id} className="flex-1">
                    {tab.title}
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="flex-1 min-h-0 p-4">
                <TabsContent value="code" className="h-full m-0">
                  <CodeEditor value={codeEditorContent} onChange={handleCodeChange} />
                </TabsContent>
                <TabsContent value="terminal" className="h-full m-0">
                  <Terminal />
                </TabsContent>
                <TabsContent value="browser" className="h-full m-0">
                  <Browser url={browserUrl} onNavigate={handleBrowserNavigate} />
                </TabsContent>
              </div>
            </Tabs>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}