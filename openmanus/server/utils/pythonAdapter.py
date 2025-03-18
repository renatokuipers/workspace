import sys
import json
import atexit
import traceback
import signal
from datetime import datetime
from threading import Thread, Event
import time
import io

# Constants for message types
MESSAGE_TYPES = {
    "SYSTEM": "system",
    "STATUS": "status",
    "ERROR": "error",
    "USER_INPUT": "user_input",
    "AGENT_OUTPUT": "agent_output",
    "STEP": "step",
    "RESULT": "result",
    "LOG": "log"
}

# Global variables
process = None
process_running = False
should_exit = False
exit_event = Event()
chunks_buffer = {}

def send_message(msg_type, payload):
    """Send a message to stdout in the agreed format"""
    try:
        message = {
            "type": msg_type,
            "payload": payload,
            "timestamp": datetime.now().isoformat()
        }
        
        message_str = json.dumps(message)
        
        # If message is small enough, send as is
        if len(message_str) <= 16384:  # Using same MAX_CHUNK_SIZE as from the instructions
            print(message_str, flush=True)
            return
        
        # For larger messages, create chunks
        message_id = f"{time.time()}-{hash(message_str)}"
        payload_str = json.dumps(payload)
        
        chunk_size = 16384
        total_chunks = (len(payload_str) + chunk_size - 1) // chunk_size
        
        for i in range(0, total_chunks):
            chunk_payload = payload_str[i * chunk_size:(i + 1) * chunk_size]
            chunk = {
                "type": f"{msg_type}_CHUNK",
                "chunkId": message_id,
                "chunkIndex": i,
                "totalChunks": total_chunks,
                "chunk": chunk_payload,
                "timestamp": datetime.now().isoformat()
            }
            
            print(json.dumps(chunk), flush=True)
            # Small delay to prevent overwhelming the Node.js process
            time.sleep(0.01)
    except Exception as e:
        error_msg = {
            "type": MESSAGE_TYPES["ERROR"],
            "payload": {
                "error": str(e),
                "traceback": traceback.format_exc()
            },
            "timestamp": datetime.now().isoformat()
        }
        print(json.dumps(error_msg), flush=True)

def handle_system_command(command_data):
    """Handle system commands"""
    global process, process_running, should_exit

    command = command_data.get("command", "")

    if command == "shutdown":
        send_message(MESSAGE_TYPES["STATUS"], {"status": "shutting_down"})
        should_exit = True
        exit_event.set()
        if process_running and process:
            try:
                # Signal the process to finish gracefully
                process.terminate()
            except Exception as e:
                send_message(MESSAGE_TYPES["ERROR"], {
                    "error": f"Error during shutdown: {str(e)}",
                    "traceback": traceback.format_exc()
                })
    elif command == "ping":
        # Respond immediately with pong
        send_message(MESSAGE_TYPES["STATUS"], {"pong": True, "timestamp": datetime.now().isoformat()})
    else:
        send_message(MESSAGE_TYPES["ERROR"], {"error": f"Unknown system command: {command}"})

def handle_incoming_message(message_str):
    """Process incoming message from Node.js"""
    try:
        message = json.loads(message_str)
        
        # Check if it's a chunk message
        if "_CHUNK" in message.get("type", ""):
            chunk_id = message.get("chunkId")
            if not chunk_id:
                send_message(MESSAGE_TYPES["ERROR"], {"error": "Received chunk without chunkId"})
                return
                
            # Store the chunk
            if chunk_id not in chunks_buffer:
                chunks_buffer[chunk_id] = []
            
            chunks_buffer[chunk_id].append(message)
            
            # Check if all chunks are received
            if len(chunks_buffer[chunk_id]) == message.get("totalChunks"):
                # Sort chunks by index
                chunks_buffer[chunk_id].sort(key=lambda x: x.get("chunkIndex", 0))
                
                # Combine the payload
                combined_payload = "".join([chunk.get("chunk", "") for chunk in chunks_buffer[chunk_id]])
                
                try:
                    # Parse the combined payload
                    payload = json.loads(combined_payload)
                    
                    # Create a complete message
                    complete_message = {
                        "type": message.get("type", "").replace("_CHUNK", ""),
                        "payload": payload,
                        "timestamp": message.get("timestamp")
                    }
                    
                    # Process the complete message
                    process_message(complete_message)
                    
                except json.JSONDecodeError as e:
                    send_message(MESSAGE_TYPES["ERROR"], {
                        "error": f"Error parsing combined chunks: {str(e)}",
                        "traceback": traceback.format_exc()
                    })
                
                # Clean up the buffer
                del chunks_buffer[chunk_id]
            
            return
        
        # Process normal message
        process_message(message)
        
    except json.JSONDecodeError as e:
        send_message(MESSAGE_TYPES["ERROR"], {
            "error": f"Invalid JSON message: {str(e)}",
            "message": message_str,
            "traceback": traceback.format_exc()
        })
    except Exception as e:
        send_message(MESSAGE_TYPES["ERROR"], {
            "error": f"Error processing message: {str(e)}",
            "traceback": traceback.format_exc()
        })

def process_message(message):
    """Process a complete message object"""
    try:
        msg_type = message.get("type")
        payload = message.get("payload", {})
        
        if msg_type == MESSAGE_TYPES["SYSTEM"]:
            handle_system_command(payload)
        elif msg_type == MESSAGE_TYPES["USER_INPUT"]:
            # Forward user input to the process
            if process_running and process:
                # Handle user input appropriately based on your application
                # This is a placeholder - implement the specific logic needed
                send_message(MESSAGE_TYPES["STATUS"], {"status": "received_input", "inputId": payload.get("id")})
            else:
                send_message(MESSAGE_TYPES["ERROR"], {"error": "No running process to receive input"})
        else:
            send_message(MESSAGE_TYPES["ERROR"], {"error": f"Unknown message type: {msg_type}"})
    except Exception as e:
        send_message(MESSAGE_TYPES["ERROR"], {
            "error": f"Error in process_message: {str(e)}",
            "traceback": traceback.format_exc()
        })

def stdin_reader():
    """Read from stdin and process messages"""
    try:
        while not exit_event.is_set():
            try:
                line = input()
                if line:
                    handle_incoming_message(line)
            except EOFError:
                # EOF means the parent process has closed, so we should exit
                break
            except Exception as e:
                send_message(MESSAGE_TYPES["ERROR"], {
                    "error": f"Error reading from stdin: {str(e)}",
                    "traceback": traceback.format_exc()
                })
                # Don't exit the loop, try to keep reading
    except KeyboardInterrupt:
        # Handle Ctrl+C gracefully
        send_message(MESSAGE_TYPES["STATUS"], {"status": "interrupted"})
    finally:
        exit_event.set()

def cleanup():
    """Clean up resources before exiting"""
    global process, process_running
    
    try:
        if process_running and process:
            process_running = False
            # Add any cleanup code for your process here
            send_message(MESSAGE_TYPES["STATUS"], {"status": "process_terminated"})
    except Exception as e:
        send_message(MESSAGE_TYPES["ERROR"], {
            "error": f"Error during cleanup: {str(e)}",
            "traceback": traceback.format_exc()
        })

def handle_signal(signum, frame):
    """Handle termination signals"""
    send_message(MESSAGE_TYPES["STATUS"], {"status": "received_signal", "signal": signum})
    cleanup()
    exit_event.set()

def main():
    """Main entry point"""
    global process, process_running, should_exit
    
    # Register cleanup handlers
    atexit.register(cleanup)
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)
    
    try:
        # Redirect stdout to buffer to separate our protocol messages from program output
        original_stdout = sys.stdout
        sys.stdout = io.StringIO()
        
        # Start stdin reader in a separate thread
        stdin_thread = Thread(target=stdin_reader, daemon=True)
        stdin_thread.start()
        
        # Tell Node that we're ready
        original_stdout.write(json.dumps({
            "type": MESSAGE_TYPES["STATUS"],
            "payload": {"status": "ready"},
            "timestamp": datetime.now().isoformat()
        }) + "\n")
        original_stdout.flush()
        
        # Wait for exit event
        while not exit_event.is_set() and not should_exit:
            # Check if there's any program output to forward
            buffered_output = sys.stdout.getvalue()
            if buffered_output:
                # Reset the buffer
                sys.stdout = io.StringIO()
                
                # Send the buffered output as a log message
                original_stdout.write(json.dumps({
                    "type": MESSAGE_TYPES["LOG"],
                    "payload": {"message": buffered_output},
                    "timestamp": datetime.now().isoformat()
                }) + "\n")
                original_stdout.flush()
            
            # Sleep a bit to avoid high CPU usage
            time.sleep(0.1)
        
        # Wait for stdin thread to finish
        stdin_thread.join(timeout=2.0)
        
    except Exception as e:
        # Make sure to use original stdout for error reporting
        try:
            original_stdout.write(json.dumps({
                "type": MESSAGE_TYPES["ERROR"],
                "payload": {
                    "error": f"Unhandled exception in main: {str(e)}",
                    "traceback": traceback.format_exc()
                },
                "timestamp": datetime.now().isoformat()
            }) + "\n")
            original_stdout.flush()
        except:
            # Last resort if JSON encoding fails
            original_stdout.write(f"FATAL ERROR: {str(e)}\n{traceback.format_exc()}\n")
            original_stdout.flush()
    finally:
        # Restore stdout
        sys.stdout = original_stdout

if __name__ == "__main__":
    main()