#!/usr/bin/env python
import sys
import json
import subprocess
import threading
import time
import os
import signal
import traceback
import io
from datetime import datetime
from threading import Event

# Configuration - Modify these constants as needed
MESSAGE_TYPES = {
    "LOG": "log",
    "SYSTEM": "system",
    "STATUS": "status",
    "ERROR": "error",
    "USER_INPUT": "user_input",
    "AGENT_OUTPUT": "agent_output",
    "STEP": "step",
    "RESULT": "result",
    "FLOW": "flow",
    "EXECUTION": "execution"
}

# Global variables
process = None
process_running = False
should_exit = False
exit_event = Event()
chunks_buffer = {}

def create_message(msg_type, payload):
    """Create a JSON message with the given type and payload."""
    message = {
        "type": msg_type,
        "payload": payload,
        "timestamp": datetime.now().isoformat()
    }
    return message

def send_message(msg_type, payload):
    """Send a message to stdout in the agreed format."""
    try:
        message = create_message(msg_type, payload)
        message_str = json.dumps(message)

        # If message is small enough, send as is
        if len(message_str) <= 16384:  # Using MAX_CHUNK_SIZE of 16KB
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
                "message": str(e),
                "traceback": traceback.format_exc()
            },
            "timestamp": datetime.now().isoformat()
        }
        print(json.dumps(error_msg), flush=True)

def send_log(level, message):
    """Send a log message."""
    payload = {
        "level": level,
        "message": message
    }
    send_message(MESSAGE_TYPES["LOG"], payload)

def send_error(error_message, traceback_str=None):
    """Send an error message."""
    payload = {
        "message": error_message,
        "traceback": traceback_str
    }
    send_message(MESSAGE_TYPES["ERROR"], payload)

def send_status(status_data):
    """Send a status update."""
    send_message(MESSAGE_TYPES["STATUS"], status_data)

def handle_system_command(payload):
    """Handle system commands from Node.js."""
    global process, process_running, should_exit
    
    command = payload.get("command", "")

    if command == "ping":
        send_status({"pong": True})
    elif command == "shutdown":
        send_status({"status": "shutting_down"})
        should_exit = True
        exit_event.set()
        if process_running and process:
            try:
                # Try to terminate gracefully first
                if hasattr(process, "terminate"):
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        # If termination times out, force kill
                        if hasattr(process, "kill"):
                            process.kill()
            except Exception as e:
                send_error(f"Error during shutdown: {str(e)}", traceback.format_exc())
        # Exit after cleanup
        sys.exit(0)
    else:
        send_error(f"Unknown system command: {command}")

def handle_incoming_message(message_str):
    """Process incoming message from Node.js"""
    try:
        message = json.loads(message_str)

        # Check if it's a chunk message
        if "_CHUNK" in message.get("type", ""):
            chunk_id = message.get("chunkId")
            if not chunk_id:
                send_error("Received chunk without chunkId")
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
                    send_error(f"Error parsing combined chunks: {str(e)}", traceback.format_exc())

                # Clean up the buffer
                del chunks_buffer[chunk_id]

            return

        # Process normal message
        process_message(message)

    except json.JSONDecodeError as e:
        send_error(f"Invalid JSON message: {str(e)}", traceback.format_exc())
    except Exception as e:
        send_error(f"Error processing message: {str(e)}", traceback.format_exc())

def process_message(message):
    """Process a complete message object"""
    try:
        msg_type = message.get("type")
        payload = message.get("payload", {})

        if msg_type == MESSAGE_TYPES["SYSTEM"]:
            handle_system_command(payload)
        elif msg_type == MESSAGE_TYPES["USER_INPUT"]:
            # Forward user input to the process
            if process_running and process and process.stdin:
                # Forward user input to the subprocess
                input_str = json.dumps(message) + "\n"
                process.stdin.write(input_str.encode('utf-8'))
                process.stdin.flush()
                send_status({"status": "received_input", "inputId": payload.get("id")})
            else:
                send_error("No running process to receive input")
        else:
            # Forward other messages to the subprocess if it's running
            if process_running and process and process.stdin:
                input_str = json.dumps(message) + "\n"
                process.stdin.write(input_str.encode('utf-8'))
                process.stdin.flush()
            else:
                send_error(f"Unknown message type or no process running: {msg_type}")
    except Exception as e:
        send_error(f"Error in process_message: {str(e)}", traceback.format_exc())

def process_input():
    """Process messages from Node.js."""
    try:
        for line in sys.stdin:
            if line.strip():
                handle_incoming_message(line.strip())
            if exit_event.is_set():
                break
    except Exception as e:
        send_error(f"Error processing input: {str(e)}", traceback.format_exc())
    finally:
        exit_event.set()

def read_process_output(pipe, level):
    """Read output from a subprocess pipe and send as log messages."""
    try:
        for line in iter(pipe.readline, b''):
            try:
                decoded_line = line.decode('utf-8').rstrip()
                if decoded_line:
                    # Check if this is likely a JSON message
                    if decoded_line.startswith('{') and decoded_line.endswith('}'):
                        try:
                            parsed_json = json.loads(decoded_line)
                            # If it has a type field, it's likely a protocol message
                            if 'type' in parsed_json:
                                print(decoded_line, flush=True)
                                continue
                        except json.JSONDecodeError:
                            # Not valid JSON, treat as regular log
                            pass
                    
                    # Regular log message
                    send_log(level, decoded_line)
            except Exception as e:
                send_error(f"Error decoding process output: {str(e)}", traceback.format_exc())
    except Exception as e:
        send_error(f"Error reading process output: {str(e)}", traceback.format_exc())

if __name__ == "__main__":
    # Get target script path from command line arguments
    if len(sys.argv) < 2:
        send_error("No target script specified")
        sys.exit(1)

    target_script = sys.argv[1]
    script_args = sys.argv[2:] if len(sys.argv) > 2 else []

    if not os.path.exists(target_script):
        send_error(f"Target script not found: {target_script}")
        sys.exit(1)

    # Start process
    try:
        send_log("info", f"Starting process: {target_script}")
        
        # Configure paths for the OpenManus imports
        current_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.abspath(os.path.join(current_dir, '..', '..'))
        openmanus_dir = os.path.join(base_dir, 'openmanus')
        
        # Create environment with updated Python path
        env = os.environ.copy()
        python_path = env.get('PYTHONPATH', '')
        if python_path:
            env['PYTHONPATH'] = f"{openmanus_dir}{os.pathsep}{python_path}"
        else:
            env['PYTHONPATH'] = openmanus_dir
            
        env['PYTHONUNBUFFERED'] = '1'
        env['PYTHONIOENCODING'] = 'utf-8'
        
        process = subprocess.Popen(
            [sys.executable, target_script] + script_args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE,
            bufsize=1,
            universal_newlines=False,
            env=env
        )
        
        process_running = True

        # Create threads to read stdout and stderr
        stdout_thread = threading.Thread(
            target=read_process_output,
            args=(process.stdout, "info")
        )
        stderr_thread = threading.Thread(
            target=read_process_output,
            args=(process.stderr, "error")
        )

        # Set threads as daemon so they exit when main thread exits
        stdout_thread.daemon = True
        stderr_thread.daemon = True

        # Start threads
        stdout_thread.start()
        stderr_thread.start()

        # Send status update
        send_status({
            "running": True,
            "pid": process.pid
        })

        # Process input from Node.js
        input_thread = threading.Thread(target=process_input)
        input_thread.daemon = True
        input_thread.start()

        # Wait for process to complete
        exit_code = process.wait()
        process_running = False

        # Send status update
        send_status({
            "running": False,
            "exitCode": exit_code
        })

        # Allow threads to finish
        stdout_thread.join(timeout=1)
        stderr_thread.join(timeout=1)
        input_thread.join(timeout=1)

        sys.exit(exit_code)

    except Exception as e:
        send_error(f"Failed to start process: {str(e)}", traceback.format_exc())
        sys.exit(1)