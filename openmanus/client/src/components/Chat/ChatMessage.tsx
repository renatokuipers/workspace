// openmanus/client/src/components/Chat/ChatMessage.tsx
import React, { useState } from 'react';
import { ChatMessage as IChatMessage } from '@/types';
import { User, Bot, Pencil, Trash, Clock } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ChatMessageProps {
  message: IChatMessage;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

const formatMessageContent = (content: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(?:com|org|net|edu|gov|mil|biz|info|io|ai|dev)(?:\/[^\s]*)?)/g;

  return content.split('\n').map((line, lineIndex) => (
    <React.Fragment key={lineIndex}>
      {line.split(urlRegex).map((part, partIndex) => {
        if (part && part.match(urlRegex)) {
          let url = part;
          if (!url.startsWith('http')) {
            url = `https://${url}`;
          }
          return (
            <a
              key={partIndex}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline break-all transition-colors duration-200"
              onClick={(e) => {
                e.preventDefault();
                window.open(url, '_blank');
              }}
            >
              {part}
            </a>
          );
        }
        return part;
      })}
      {lineIndex < content.split('\n').length - 1 && <br />}
    </React.Fragment>
  ));
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onEdit, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [isHovered, setIsHovered] = useState(false);
  const isUser = message.role === 'user';

  const handleEdit = () => {
    onEdit(message.id, editedContent);
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setEditedContent(message.content);
    setIsEditing(false);
  };

  const messageDate = new Date(message.timestamp);

  return (
    <div
      className={cn(
        "flex w-full gap-4 p-4 transition-colors duration-200",
        isUser ? "flex-row-reverse bg-primary/10" : "bg-muted/30"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Avatar className={cn(
        "ring-2 ring-offset-2",
        isUser ? "ring-primary" : "ring-secondary"
      )}>
        <AvatarFallback className={cn(
          "bg-gradient-to-br",
          isUser ? "from-primary to-primary/70" : "from-secondary to-secondary/70"
        )}>
          {isUser ? <User className="h-4 w-4 text-primary-foreground" /> : <Bot className="h-4 w-4 text-secondary-foreground" />}
        </AvatarFallback>
      </Avatar>
      <div className={cn(
        "flex flex-col max-w-[80%] gap-2",
        isUser ? "items-end" : "items-start"
      )}>
        <div className={cn(
          "rounded-lg p-3 shadow-lg transition-transform duration-200 hover:scale-[1.02] w-full",
          isUser ?
            "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground" :
            "bg-gradient-to-br from-card to-muted text-card-foreground"
        )}>
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[100px] w-full bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80 text-foreground"
                style={{ cursor: 'text' }}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleEdit}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {formatMessageContent(message.content)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200">
                  <Clock className="h-3 w-3" />
                  <span>{formatDistanceToNow(messageDate, { addSuffix: true })}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{format(messageDate, 'PPpp')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {isUser && !isEditing && isHovered && (
            <div className="flex gap-1 animate-fade-in">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-accent/50"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-accent/50"
                onClick={() => onDelete(message.id)}
              >
                <Trash className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};