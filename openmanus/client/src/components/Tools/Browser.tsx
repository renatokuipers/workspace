// openmanus/client/src/Tools/Browser.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RefreshCw, ArrowLeft, ArrowRight, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { navigateToUrl, createBrowser, closeBrowser, goBack, goForward, refreshPage } from '@/api/browser';

interface BrowserProps {
  url: string;
  onNavigate: (url: string) => void;
}

export const Browser: React.FC<BrowserProps> = ({ url, onNavigate }) => {
  const [browserId, setBrowserId] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>(url || '');
  const [currentTitle, setCurrentTitle] = useState<string>('');
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // URL input ref for focus management
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Initialize browser
  useEffect(() => {
    const initializeBrowser = async () => {
      try {
        setIsLoading(true);
        const result = await createBrowser();
        if (!result.success) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to create browser instance"
          });
          return;
        }
        setBrowserId(result.browserId);
        
        // If initial URL is provided, navigate to it
        if (url) {
          await handleNavigation(url);
        }
      } catch (error) {
        console.error('Error initializing browser:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to initialize browser"
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeBrowser();

    // Cleanup when component unmounts
    return () => {
      if (browserId) {
        closeBrowser(browserId).catch(error => {
          console.error('Error closing browser:', error);
        });
      }
    };
  }, []);

  // Format URL before navigation
  const formatUrl = (inputUrl: string): string => {
    let formattedUrl = inputUrl.trim();
    
    // If URL doesn't start with a protocol, add https://
    if (!formattedUrl.startsWith('http://') && 
        !formattedUrl.startsWith('https://') && 
        !formattedUrl.startsWith('file://')) {
      
      // Check if it's likely a domain name
      if (formattedUrl.includes('.') && !formattedUrl.includes(' ')) {
        formattedUrl = `https://${formattedUrl}`;
      } else {
        // Treat as a search query
        formattedUrl = `https://www.google.com/search?q=${encodeURIComponent(formattedUrl)}`;
      }
    }
    
    return formattedUrl;
  };

  // Handle direct URL navigation
  const handleDirectNavigation = async (formattedUrl: string) => {
    if (!browserId) {
      console.error('Browser not initialized');
      return;
    }

    try {
      setIsLoading(true);
      setCurrentUrl(formattedUrl);
      
      const result = await navigateToUrl(browserId, formattedUrl);
      
      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Navigation Error",
          description: result.error || "Failed to navigate to URL"
        });
        return;
      }
      
      // Update state with navigation results
      setCurrentUrl(result.url);
      setCurrentTitle(result.title || '');
      setScreenshot(`data:image/png;base64,${result.screenshot}`);
      setCanGoBack(result.canGoBack);
      setCanGoForward(result.canGoForward);
      
      // Notify parent component
      if (onNavigate) {
        onNavigate(result.url);
      }
    } catch (error) {
      console.error('Error navigating to URL:', error);
      toast({
        variant: "destructive",
        title: "Navigation Error",
        description: "Failed to navigate to URL"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle navigation, with proper URL formatting
  const handleNavigation = async (inputUrl: string, updateHistory = true) => {
    const formattedUrl = formatUrl(inputUrl);
    await handleDirectNavigation(formattedUrl);
  };

  // Navigate back in history
  const handleBack = async () => {
    if (!browserId || !canGoBack) return;
    
    try {
      setIsLoading(true);
      
      const result = await goBack(browserId);
      
      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Navigation Error",
          description: result.error || "Failed to go back"
        });
        return;
      }
      
      // Update state with navigation results
      setCurrentUrl(result.url);
      setCurrentTitle(result.title || '');
      setScreenshot(`data:image/png;base64,${result.screenshot}`);
      setCanGoBack(result.canGoBack);
      setCanGoForward(result.canGoForward);
      
      // Notify parent component
      if (onNavigate) {
        onNavigate(result.url);
      }
    } catch (error) {
      console.error('Error going back:', error);
      toast({
        variant: "destructive",
        title: "Navigation Error",
        description: "Failed to go back"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate forward in history
  const handleForward = async () => {
    if (!browserId || !canGoForward) return;
    
    try {
      setIsLoading(true);
      
      const result = await goForward(browserId);
      
      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Navigation Error",
          description: result.error || "Failed to go forward"
        });
        return;
      }
      
      // Update state with navigation results
      setCurrentUrl(result.url);
      setCurrentTitle(result.title || '');
      setScreenshot(`data:image/png;base64,${result.screenshot}`);
      setCanGoBack(result.canGoBack);
      setCanGoForward(result.canGoForward);
      
      // Notify parent component
      if (onNavigate) {
        onNavigate(result.url);
      }
    } catch (error) {
      console.error('Error going forward:', error);
      toast({
        variant: "destructive",
        title: "Navigation Error",
        description: "Failed to go forward"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh the current page
  const handleRefresh = async () => {
    if (!browserId) return;
    
    try {
      setIsLoading(true);
      
      const result = await refreshPage(browserId);
      
      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Refresh Error",
          description: result.error || "Failed to refresh page"
        });
        return;
      }
      
      // Update state with refresh results
      setCurrentUrl(result.url);
      setCurrentTitle(result.title || '');
      setScreenshot(`data:image/png;base64,${result.screenshot}`);
      setCanGoBack(result.canGoBack);
      setCanGoForward(result.canGoForward);
    } catch (error) {
      console.error('Error refreshing page:', error);
      toast({
        variant: "destructive",
        title: "Refresh Error",
        description: "Failed to refresh page"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submit for URL navigation
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleNavigation(currentUrl);
  };

  return (
    <Card className="h-full flex flex-col border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-2 border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          disabled={!canGoBack || isLoading}
          className="hover:bg-accent/50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleForward}
          disabled={!canGoForward || isLoading}
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
            ref={urlInputRef}
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