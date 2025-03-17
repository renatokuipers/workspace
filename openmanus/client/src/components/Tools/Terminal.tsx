// openmanus/client/src/components/Tools/Terminal.tsx
import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { WebglAddon } from 'xterm-addon-webgl';
import { SearchAddon } from 'xterm-addon-search';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
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

  useEffect(() => {
    if (!terminalRef.current) return;

    const initializeTerminal = async () => {
      // Initialize xterm.js
      const term = new XTerm({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: '"JetBrains Mono", monospace',
        theme: {
          background: '#1a1b26',
          foreground: '#a9b1d6',
          cursor: '#a9b1d6',
          black: '#32344a',
          red: '#f7768e',
          green: '#9ece6a',
          yellow: '#e0af68',
          blue: '#7aa2f7',
          magenta: '#ad8ee6',
          cyan: '#449dab',
          white: '#787c99',
          brightBlack: '#444b6a',
          brightRed: '#ff7a93',
          brightGreen: '#b9f27c',
          brightYellow: '#ff9e64',
          brightBlue: '#7da6ff',
          brightMagenta: '#bb9af7',
          brightCyan: '#0db9d7',
          brightWhite: '#acb0d0',
        },
        allowTransparency: true,
        convertEol: true,
        scrollback: 1000,
        windowsMode: true,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      const webglAddon = new WebglAddon();
      const searchAddon = new SearchAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.loadAddon(searchAddon);

      try {
        term.loadAddon(webglAddon);
      } catch (e) {
        console.warn('WebGL addon could not be loaded', e);
      }

      term.open(terminalRef.current);
      fitAddon.fit();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const wsUrl = `${wsProtocol}//${wsHost}/ws/terminal`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        term.write('\r\n\x1B[1;32mConnected to terminal.\x1B[0m\r\n\r\n');
      };

      ws.onmessage = (event) => {
        try {
          const { type, data } = JSON.parse(event.data);
          if (type === 'output') {
            term.write(data);
          } else if (type === 'error') {
            toast({
              variant: "destructive",
              title: "Terminal Error",
              description: data
            });
          }
        } catch (error) {
          console.error('Error handling terminal message:', error);
        }
      };

      ws.onclose = () => {
        term.write('\r\n\x1B[1;31mDisconnected from terminal.\x1B[0m\r\n');
        toast({
          variant: "destructive",
          title: "Terminal Disconnected",
          description: "Terminal connection was closed. Refresh to reconnect."
        });
      };

      ws.onerror = () => {
        toast({
          variant: "destructive",
          title: "Terminal Error",
          description: "Failed to connect to terminal server"
        });
      };

      term.onKey(({ key, domEvent }) => {
        if (ws.readyState === WebSocket.OPEN) {
          const char = key;

          if (domEvent.keyCode === 8) { // Backspace
            ws.send(JSON.stringify({ type: 'input', data: String.fromCharCode(127) }));
          } else if (domEvent.keyCode === 13) { // Enter
            ws.send(JSON.stringify({ type: 'input', data: '\r' }));
          } else {
            ws.send(JSON.stringify({ type: 'input', data: char }));
          }
        }
      });

      term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', data: { cols, rows } }));
        }
      });

      const handleResize = () => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        if (wsRef.current) {
          wsRef.current.close();
        }
        if (xtermRef.current) {
          webLinksAddon.dispose();
          webglAddon.dispose();
          searchAddon.dispose();
          fitAddon.dispose();
          xtermRef.current.dispose();
        }
        window.removeEventListener('resize', handleResize);
      };
    };

    setTimeout(initializeTerminal, 100);
  }, [toast]);

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