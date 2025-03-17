import os
from pathlib import Path
import aiofiles

from app.tool.base import BaseTool
from app.config import WORKSPACE_ROOT, ensure_workspace_exists


class FileSaver(BaseTool):
    name: str = "file_saver"
    description: str = """Save content to a local file at a specified path.
Use this tool when you need to save text, code, or generated content to a file on the local filesystem.
The tool accepts content and a file path, and saves the content to that location.
If a relative path is provided, it will be saved relative to the workspace directory.
"""
    parameters: dict = {
        "type": "object",
        "properties": {
            "content": {
                "type": "string",
                "description": "(required) The content to save to the file.",
            },
            "file_path": {
                "type": "string",
                "description": "(required) The path where the file should be saved, including filename and extension.",
            },
            "mode": {
                "type": "string",
                "description": "(optional) The file opening mode. Default is 'w' for write. Use 'a' for append.",
                "enum": ["w", "a"],
                "default": "w",
            },
        },
        "required": ["content", "file_path"],
    }

    async def execute(self, content: str, file_path: str, mode: str = "w") -> str:
        """
        Save content to a file at the specified path.

        Args:
            content (str): The content to save to the file.
            file_path (str): The path where the file should be saved.
            mode (str, optional): The file opening mode. Default is 'w' for write. Use 'a' for append.

        Returns:
            str: A message indicating the result of the operation.
        """
        try:
            # Make sure our workspace exists - this is the key part we were missing!
            workspace_dir = ensure_workspace_exists()
            
            # Turn string path into a Path object (makes manipulation way easier)
            path = Path(file_path)
            
            # If they gave us a relative path, put it in our workspace
            if not path.is_absolute():
                path = workspace_dir / path
                
            # Make sure parent folders exist
            directory = path.parent
            if directory and not directory.exists():
                directory.mkdir(parents=True, exist_ok=True)

            # Write the content to the file
            async with aiofiles.open(path, mode, encoding="utf-8") as file:
                await file.write(content)

            return f"Content successfully saved to {path}"
        except Exception as e:
            return f"Error saving file: {str(e)}"