import { toast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

export const useToast = () => {
  const showToast = ({ title, description, variant = "default" }: ToastOptions) => {
    if (variant === "destructive") {
      toast.error(description || title, {
        description: description ? title : undefined,
      });
    } else {
      toast.success(description || title, {
        description: description ? title : undefined,
      });
    }
  };

  return { toast: showToast };
};