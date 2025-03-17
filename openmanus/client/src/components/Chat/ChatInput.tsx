// openmanus/client/src/Chat/ChatInput.tsx
import React from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useForm, Controller } from 'react-hook-form';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
}

interface FormValues {
  message: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
  const { control, handleSubmit, reset, formState } = useForm<FormValues>({
    defaultValues: {
      message: ''
    }
  });

  const onSubmit = (data: FormValues) => {
    if (!data.message.trim()) return;
    onSendMessage(data.message);
    reset();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, currentValue: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (currentValue.trim()) {
        handleSubmit(onSubmit)();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2 p-4 border-t bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
      <Controller
        name="message"
        control={control}
        render={({ field }) => (
          <Textarea
            {...field}
            placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
            className="min-h-[60px] flex-1 bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/50"
            onKeyDown={(e) => handleKeyDown(e, field.value)}
            disabled={isLoading}
          />
        )}
      />
      <Button 
        type="submit" 
        disabled={isLoading}
        className="bg-primary hover:bg-primary/90 transition-colors duration-200 hover:scale-105 active:scale-95"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
};