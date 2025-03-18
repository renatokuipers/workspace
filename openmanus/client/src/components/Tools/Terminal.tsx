import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { WebglAddon } from 'xterm-addon-webgl';
import { SearchAddon } from 'xterm-addon-search';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/components/ui/theme-provider';
// Add these imports
import { createTerminal, executeCommand, resizeTerminal, closeTerminal, onTerminalData } from '@/api/terminal';
import 'xterm/css/xterm.css';

interface TerminalProps {
  className?: string;
}

export const Terminal: React.FC<TerminalProps> = ({ className }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const { toast } = useToast();
  // Add theme context
  const { theme } = useTheme();
  // Determine if dark mode is enabled
  const isDarkMode = theme === 'dark';

  useEffect(() => {
    const initializeTerminal = async () => {
      try {
        // Create a terminal instance
        const result = await createTerminal();

        if (!result.success) {
          console.error('Failed to create terminal:', result.error);
          return;
        }

        // Setup xterm.js
        const term = new XTerm({
          fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
          fontSize: 14,
          fontWeight: 'normal',
          lineHeight: 1.2,
          cursorBlink: true,
          theme: {
            background: isDarkMode ? '#1a1b26' : '#f5f5f5',
            foreground: isDarkMode ? '#a9b1d6' : '#2e3440',
            cursor: isDarkMode ? '#c0caf5' : '#5e81ac',
            selectionBackground: isDarkMode ? '#28385e' : '#d8dee9',
          }
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Render the terminal
        if (terminalRef.current) {
          term.open(terminalRef.current);
          fitAddon.fit();
        }

        // Handle terminal input
        term.onData((data) => {
          executeCommand(data).catch(error => {
            console.error('Error sending terminal input:', error);
          });
        });

        // Listen for terminal output
        const unsubscribe = onTerminalData((data) => {
          if (data.type === 'output' && data.data) {
            term.write(data.data);
          } else if (data.type === 'error' && data.data) {
            term.write(`\r\n\x1B[1;31mError: ${data.data}\x1B[0m\r\n`);
          } else if (data.type === 'connected' && data.data) {
            term.write(`\r\n\x1B[1;32m${data.data}\x1B[0m\r\n`);
          }
        });

        // Handle window resize
        const handleResize = () => {
          if (fitAddonRef.current) {
            fitAddonRef.current.fit();
            if (xtermRef.current) {
              const { rows, cols } = xtermRef.current;
              resizeTerminal(cols, rows);
            }
          }
        };

        window.addEventListener('resize', handleResize);

        // Clean up on unmount
        return () => {
          window.removeEventListener('resize', handleResize);
          unsubscribe();
          if (xtermRef.current) {
            xtermRef.current.dispose();
          }
          closeTerminal();
        };
      } catch (error) {
        console.error('Error initializing terminal:', error);
      }
    };

    initializeTerminal();
  }, [isDarkMode]);

  return (
    <Card className={cn('h-full border rounded-lg overflow-hidden p-2 bg-[#1a1b26]', className)}>
      <div
        ref={terminalRef}
        className="h-full w-full focus:outline-none"
        style={{ padding: '4px' }}
        tabIndex={0}
      />
    </Card>
  );
};