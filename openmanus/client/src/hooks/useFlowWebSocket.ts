import { useState, useEffect, useCallback, useRef } from 'react';
import flowWebSocket, { FlowStatus, FlowMessage } from '../api/flowWebSocket';
import { useToast } from '@/hooks/useToast';

interface UseFlowWebSocketProps {
  autoConnect?: boolean;
  onMessage?: (message: FlowMessage) => void;
  onStatusChange?: (status: FlowStatus) => void;
  onError?: (error: any) => void;
  onProcessExit?: (exitInfo: any) => void;
}

export function useFlowWebSocket({
  autoConnect = true,
  onMessage,
  onStatusChange,
  onError,
  onProcessExit
}: UseFlowWebSocketProps = {}) {
  const [connected, setConnected] = useState(flowWebSocket.isWebSocketConnected());
  const [status, setStatus] = useState<FlowStatus | null>(null);
  const [messages, setMessages] = useState<FlowMessage[]>([]);
  const [error, setError] = useState<any>(null);

  // Add toast for user feedback
  const { toast } = useToast();

  // Keep references to callback props to avoid dependency issues
  const onMessageRef = useRef(onMessage);
  const onStatusChangeRef = useRef(onStatusChange);
  const onErrorRef = useRef(onError);
  const onProcessExitRef = useRef(onProcessExit);

  // Update refs when props change
  useEffect(() => {
    onMessageRef.current = onMessage;
    onStatusChangeRef.current = onStatusChange;
    onErrorRef.current = onError;
    onProcessExitRef.current = onProcessExit;
  }, [onMessage, onStatusChange, onError, onProcessExit]);

  // Connect to WebSocket
  useEffect(() => {
    if (autoConnect) {
      flowWebSocket.connect();
    }

    return () => {
      // No need to disconnect when component unmounts
      // since this is a singleton connection
    };
  }, [autoConnect]);

  // Set up event listeners
  useEffect(() => {
    const handleConnected = () => {
      setConnected(true);
      setError(null);
    };

    const handleDisconnected = () => {
      setConnected(false);
    };

    const handleStatus = (newStatus: FlowStatus) => {
      setStatus(newStatus);
      if (onStatusChangeRef.current) {
        onStatusChangeRef.current(newStatus);
      }
    };

    const handleMessage = (message: FlowMessage) => {
      setMessages(prev => [...prev, message]);
      if (onMessageRef.current) {
        onMessageRef.current(message);
      }
    };

    const handleError = (err: any) => {
      setError(err);

      // Show a user-friendly toast notification
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: err.message || "Failed to connect to the OpenManus backend."
      });

      if (onErrorRef.current) {
        onErrorRef.current(err);
      }
    };

    const handleProcessExit = (exitInfo: any) => {
      if (onProcessExitRef.current) {
        onProcessExitRef.current(exitInfo);
      }
    };

    // Register event listeners
    flowWebSocket.on('connected', handleConnected);
    flowWebSocket.on('disconnected', handleDisconnected);
    flowWebSocket.on('status', handleStatus);
    flowWebSocket.on('message', handleMessage);
    flowWebSocket.on('error', handleError);
    flowWebSocket.on('process_exit', handleProcessExit);

    // Clean up event listeners on unmount
    return () => {
      flowWebSocket.removeListener('connected', handleConnected);
      flowWebSocket.removeListener('disconnected', handleDisconnected);
      flowWebSocket.removeListener('status', handleStatus);
      flowWebSocket.removeListener('message', handleMessage);
      flowWebSocket.removeListener('error', handleError);
      flowWebSocket.removeListener('process_exit', handleProcessExit);
    };
  }, [toast]);

  // Exposed methods as callbacks to avoid recreation on every render
  const connect = useCallback(() => {
    flowWebSocket.connect();
  }, []);

  const disconnect = useCallback(() => {
    flowWebSocket.disconnect();
  }, []);

  const startProcess = useCallback((initialPrompt?: string) => {
    // Show a loading toast
    toast({
      title: "Starting OpenManus",
      description: "Connecting to the backend service..."
    });

    return flowWebSocket.startProcess(initialPrompt)
      .then(result => {
        if (result.success) {
          toast({
            title: "Connected Successfully",
            description: "OpenManus is ready to assist you.",
            variant: "success"
          });
        }
        return result;
      })
      .catch(error => {
        let errorMessage = error.message;

        // Provide more helpful error messages based on common issues
        if (errorMessage.includes("Python") && errorMessage.includes("not found")) {
          errorMessage = "Python interpreter not found. Please install Python and configure the server.";
        } else if (errorMessage.includes("script") && errorMessage.includes("not found")) {
          errorMessage = "OpenManus script not found. Please ensure the Python package is installed correctly.";
        }

        toast({
          variant: "destructive",
          title: "Failed to Start",
          description: errorMessage
        });

        throw error;
      });
  }, [toast]);

  const stopProcess = useCallback(() => {
    return flowWebSocket.stopProcess();
  }, []);

  const getStatus = useCallback(() => {
    return flowWebSocket.getStatus();
  }, []);

  const sendCommand = useCallback((command: string, timeout?: number) => {
    return flowWebSocket.sendCommand({ command, timeout });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    connected,
    status,
    messages,
    error,
    connect,
    disconnect,
    startProcess,
    stopProcess,
    getStatus,
    sendCommand,
    clearMessages,
    clearError
  };
}

export default useFlowWebSocket;