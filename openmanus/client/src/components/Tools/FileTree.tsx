import React, { useMemo, useRef } from 'react';
import { ChevronRight, ChevronDown, File, Folder, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FileNode } from '@/types';
import { uploadFile } from '@/api/files';
import { useToast } from '@/hooks/useToast';

interface FileTreeProps {
  files: FileNode[];
  onSelect: (file: FileNode) => void;
  selectedFile?: FileNode;
  rootPath?: string;
}

interface FileTreeNodeProps {
  node: FileNode;
  level: number;
  onSelect: (file: FileNode) => void;
  selectedFile?: FileNode;
}

const normalizePath = (path: string): string => {
  return path.replace(/\\/g, '/');
};

const extractProjectName = (path: string): string => {
  if (!path) return '';

  const normalizedPath = normalizePath(path);
  const parts = normalizedPath.split('/');
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]) return parts[i];
  }
  return '';
};

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, level, onSelect, selectedFile }) => {
  const [isOpen, setIsOpen] = React.useState(true);
  const isDirectory = node.type === 'directory';
  const isSelected = selectedFile?.id === node.id;

  return (
    <div>
      <div
        className={cn(
          "flex items-center py-2 px-3 cursor-pointer hover:bg-accent/50 rounded-md my-1",
          isSelected && "bg-accent text-accent-foreground",
          "transition-all duration-200 hover:translate-x-1"
        )}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={() => {
          if (isDirectory) {
            setIsOpen(!isOpen);
          } else {
            onSelect(node);
          }
        }}
      >
        <div className="mr-2">
          {isDirectory ? (
            isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <File className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        {isDirectory && <Folder className="h-4 w-4 mr-2 text-muted-foreground" />}
        <span className="text-sm font-medium">{node.name}</span>
      </div>
      {isDirectory && isOpen && node.children && (
        <div className="transition-all duration-200">
          {node.children.map((child) => (
            <FileTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              selectedFile={selectedFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const filterFileTree = (files: FileNode[], rootPath: string): FileNode[] => {
  if (!rootPath) return files;

  const normalizedRootPath = normalizePath(rootPath);
  const projectName = extractProjectName(normalizedRootPath);

  const findProjectFiles = (nodes: FileNode[], path = ''): FileNode[] => {
    let result: FileNode[] = [];

    for (const node of nodes) {
      const nodePath = path ? `${path}/${node.name}` : node.name;

      if (nodePath === projectName || path.includes(projectName)) {
        const nodeCopy = { ...node };

        if (node.type === 'directory' && node.children) {
          nodeCopy.children = findProjectFiles(node.children, nodePath);
        }

        result.push(nodeCopy);
      }
      else if (node.type === 'directory' && node.children) {
        const childResults = findProjectFiles(node.children, nodePath);
        if (childResults.length > 0) {
          result.push({
            ...node,
            children: childResults
          });
        }
      }
    }

    return result;
  };

  return findProjectFiles(files);
};

export const FileTree: React.FC<FileTreeProps> = ({ files, onSelect, selectedFile, rootPath }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const filteredFiles = useMemo(() => {
    return rootPath ? filterFileTree(files, rootPath) : files;
  }, [files, rootPath]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadFile(file);
      if (result.success) {
        toast({
          title: "Success",
          description: "File uploaded successfully"
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to upload file"
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredFiles.length > 0 ? (
            filteredFiles.map((file) => (
              <FileTreeNode
                key={file.id}
                node={file}
                level={0}
                onSelect={onSelect}
                selectedFile={selectedFile}
              />
            ))
          ) : (
            <div className="p-4 text-sm text-muted-foreground">
              No files found in {extractProjectName(rootPath || '')}
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-2 border-t">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button
          variant="outline"
          className="w-full flex items-center gap-2 hover:bg-accent/50"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Upload File
        </Button>
      </div>
    </div>
  );
};