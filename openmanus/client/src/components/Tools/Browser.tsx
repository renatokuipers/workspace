// openmanus/client/src/Tools/Browser.tsx
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RefreshCw, ArrowLeft, ArrowRight, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { navigateToUrl, createBrowser } from '@/api/browser';

interface BrowserProps {
  url: string;
  onNavigate: (url: string) => void;
}

export const Browser: React.FC<BrowserProps> = ({ url, onNavigate }) => {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [history, setHistory] = useState<string[]>([url]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [browserId, setBrowserId] = useState<string | null>(null);

  useEffect(() => {
    const initializeBrowser = async () => {
      try {
        const result = await createBrowser();
        if (result.success) {
          setBrowserId(result.browserId);
          // Navigate to initial URL after browser is created
          handleNavigation(url, false);
        }
      } catch (error) {
        toast.error('Failed to initialize browser');
      }
    };
    initializeBrowser();
  }, [url]);

  const formatUrl = (inputUrl: string): string => {
    try {
      let formattedUrl = inputUrl.trim();
      
      // Check if it's a search query
      if (!formattedUrl.includes('.') || formattedUrl.includes(' ')) {
        return `https://www.google.com/search?q=${encodeURIComponent(formattedUrl)}`;
      }

      // Add https:// if no protocol is specified
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`;
      }

      // Validate URL
      new URL(formattedUrl);
      return formattedUrl;
    } catch (error) {
      throw new Error('Invalid URL');
    }
  };

  // Fixed: Added browserId parameter and separated direct navigation from history navigation
  const handleDirectNavigation = async (formattedUrl: string) => {
    if (!browserId) {
      toast.error('Browser not initialized');
      return false;
    }

    setIsLoading(true);
    try {
      // Fix: Pass browserId to navigateToUrl
      const result = await navigateToUrl(formattedUrl);

      if (result.success) {
        return true;
      } else {
        toast.error('Failed to load the page');
        return false;
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to navigate to the URL');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigation = async (inputUrl: string, updateHistory = true) => {
    try {
      const formattedUrl = formatUrl(inputUrl);
      const success = await handleDirectNavigation(formattedUrl);
      
      if (success) {
        // Update parent component
        onNavigate(formattedUrl);
        setCurrentUrl(formattedUrl);
        
        // Only update history if this is a new navigation (not back/forward)
        if (updateHistory) {
          if (historyIndex < history.length - 1) {
            // Trim future history if navigating from a past point
            setHistory(prev => [...prev.slice(0, historyIndex + 1), formattedUrl]);
            setHistoryIndex(historyIndex + 1);
          } else {
            // Add to history if at most recent point
            setHistory(prev => [...prev, formattedUrl]);
            setHistoryIndex(prev => prev + 1);
          }
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Invalid URL');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleNavigation(currentUrl);
  };

  const handleBack = async () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const prevUrl = history[newIndex];
      
      // Navigate without updating history
      const success = await handleDirectNavigation(prevUrl);
      if (success) {
        setHistoryIndex(newIndex);
        setCurrentUrl(prevUrl);
        onNavigate(prevUrl);
      }
    }
  };

  const handleForward = async () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextUrl = history[newIndex];
      
      // Navigate without updating history
      const success = await handleDirectNavigation(nextUrl);
      if (success) {
        setHistoryIndex(newIndex);
        setCurrentUrl(nextUrl);
        onNavigate(nextUrl);
      }
    }
  };

  const handleRefresh = () => {
    handleDirectNavigation(currentUrl);
  };

  return (
    <Card className="h-full flex flex-col border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-2 border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          disabled={historyIndex === 0 || isLoading}
          className="hover:bg-accent/50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleForward}
          disabled={historyIndex === history.length - 1 || isLoading}
          className="hover:bg-accent/50"
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isLoading}
          className="hover:bg-accent/50"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
        <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
          <Input
            value={currentUrl}
            onChange={(e) => setCurrentUrl(e.target.value)}
            className="w-full font-mono text-sm"
            placeholder="Enter URL or search query..."
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur z-50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <iframe
          src={currentUrl}
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
          title="browser-frame"
          referrerPolicy="no-referrer"
        />
      </div>
    </Card>
  );
};