import React, { useMemo } from 'react';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileNode } from '@/types';

interface FileTreeProps {
  files: FileNode[];
  onSelect: (file: FileNode) => void;
  selectedFile?: FileNode;
  rootPath?: string; // New prop for filtering to specific project
}

interface FileTreeNodeProps {
  node: FileNode;
  level: number;
  onSelect: (file: FileNode) => void;
  selectedFile?: FileNode;
}

// Helper to normalize file paths (handling Windows backslashes)
const normalizePath = (path: string): string => {
  return path.replace(/\\/g, '/');
};

// Helper to extract the project name from a full path
const extractProjectName = (path: string): string => {
  if (!path) return '';
  
  const normalizedPath = normalizePath(path);
  const parts = normalizedPath.split('/');
  // Get the last non-empty part as the project name
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

// New function to filter and transform the file tree to only show project files
const filterFileTree = (files: FileNode[], rootPath: string): FileNode[] => {
  if (!rootPath) return files;
  
  const normalizedRootPath = normalizePath(rootPath);
  const projectName = extractProjectName(normalizedRootPath);
  
  // Find all files that match the project path
  const findProjectFiles = (nodes: FileNode[], path = ''): FileNode[] => {
    let result: FileNode[] = [];
    
    for (const node of nodes) {
      const nodePath = path ? `${path}/${node.name}` : node.name;
      
      // If the node's path is the project we're looking for or its child
      if (nodePath === projectName || path.includes(projectName)) {
        // Create a copy of the node to avoid mutating the original
        const nodeCopy = { ...node };
        
        // If it's a directory, recursively process its children
        if (node.type === 'directory' && node.children) {
          nodeCopy.children = findProjectFiles(node.children, nodePath);
        }
        
        result.push(nodeCopy);
      }
      // If the node might contain our project deeper in its structure
      else if (node.type === 'directory' && node.children) {
        const childResults = findProjectFiles(node.children, nodePath);
        if (childResults.length > 0) {
          // Only include this directory if it contains matching files
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
  // Use useMemo to prevent unnecessary re-filtering on each render
  const filteredFiles = useMemo(() => {
    return rootPath ? filterFileTree(files, rootPath) : files;
  }, [files, rootPath]);

  return (
    <ScrollArea className="h-full">
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
  );
};