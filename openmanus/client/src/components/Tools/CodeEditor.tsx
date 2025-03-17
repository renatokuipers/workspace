// openmanus/client/src/Tools/CodeEditor.tsx
import React, { useEffect, useState } from 'react';
import Editor, { BeforeMount } from '@monaco-editor/react';
import { Card } from '@/components/ui/card';
import { FileTree } from './FileTree';
import { getFileTree, getFileContent, saveFileContent } from '@/api/files';
import { FileNode } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  language?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, language = 'typescript' }) => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const { files } = await getFileTree();
        setFiles(files);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load files"
        });
      }
    };
    loadFiles();
  }, []);

  const handleFileSelect = async (file: FileNode) => {
    if (file.type === 'file') {
      setIsLoading(true);
      try {
        setSelectedFile(file);
        if (!file.content) {
          const { content } = await getFileContent(file.id);
          onChange(content);
        } else {
          onChange(file.content);
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load file content"
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleEditorChange = async (newValue: string | undefined) => {
    onChange(newValue);
    if (selectedFile && newValue) {
      try {
        await saveFileContent(selectedFile.id, newValue);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to save file content"
        });
      }
    }
  };

  const beforeMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme('custom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955' },
        { token: 'keyword', foreground: 'C586C0' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'operator', foreground: 'D4D4D4' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'class', foreground: '4EC9B0' },
        { token: 'interface', foreground: '4EC9B0' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' },
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editor.lineHighlightBackground': '#2D2D2D',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#C6C6C6',
        'editorCursor.foreground': '#D4D4D4',
        'editor.selectionHighlightBackground': '#2D2D2D',
      },
    });
  };

  return (
    <Card className="h-full border rounded-lg overflow-hidden flex bg-background">
      <div className="w-64 border-r bg-muted/50 backdrop-blur supports-[backdrop-filter]:bg-muted/50">
        <FileTree
          files={files}
          onSelect={handleFileSelect}
          selectedFile={selectedFile}
        />
      </div>
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur z-50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <Editor
          height="100%"
          defaultLanguage={language}
          value={value}
          onChange={handleEditorChange}
          beforeMount={beforeMount}
          theme="custom-dark"
          loading={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
          options={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 14,
            lineHeight: 1.6,
            fontLigatures: true,
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            minimap: {
              enabled: true,
              scale: 2,
              showSlider: 'mouseover',
            },
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              verticalScrollbarSize: 12,
              horizontalScrollbarSize: 12,
            },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            bracketPairColorization: {
              enabled: true,
            },
            renderWhitespace: 'selection',
            padding: {
              top: 16,
              bottom: 16,
            },
            wordWrap: 'on',
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            tabSize: 2,
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </Card>
  );
};