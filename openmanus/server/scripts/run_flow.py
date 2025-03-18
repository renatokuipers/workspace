#!/usr/bin/env python3
"""
run_flow.py - Script for running flows in the OpenManus application

This script executes a flow with the provided parameters and returns the results.
It is called by the Node.js server through child_process.exec.
"""

import sys
import json
import traceback
import logging
import os
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("run_flow")

def setup_environment():
    """Set up any environment required for the flow to run."""
    logger.info("Setting up environment for flow execution")
    # Additional setup can be added here as needed
    
def parse_arguments():
    """Parse command line arguments passed from the Node.js server."""
    logger.info("Parsing flow arguments")
    try:
        # Expecting a JSON string as the first argument
        if len(sys.argv) < 2:
            logger.error("No arguments provided. Expected flow configuration as JSON.")
            return None
        
        flow_config = json.loads(sys.argv[1])
        logger.info(f"Received flow configuration: {flow_config}")
        return flow_config
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON arguments: {e}")
        logger.error(traceback.format_exc())
        return None
    except Exception as e:
        logger.error(f"Unexpected error parsing arguments: {e}")
        logger.error(traceback.format_exc())
        return None

def execute_flow(flow_config):
    """Execute the flow with the given configuration."""
    logger.info(f"Executing flow with ID: {flow_config.get('id', 'unknown')}")
    
    try:
        # Placeholder for actual flow execution logic
        # In a real implementation, this would integrate with your flow runner system
        
        # Extract flow parameters
        flow_id = flow_config.get('id')
        parameters = flow_config.get('parameters', {})
        
        # Log execution start
        start_time = datetime.now()
        logger.info(f"Flow execution started at {start_time}")
        
        # Simulate flow execution (replace with actual execution logic)
        # This is where you would call your actual flow execution library/code
        results = {
            "status": "completed",
            "flow_id": flow_id,
            "execution_time": str((datetime.now() - start_time).total_seconds()),
            "results": {
                "message": "Flow executed successfully",
                "output_data": {"sample": "data"}
            }
        }
        
        logger.info(f"Flow execution completed successfully")
        return results
    
    except Exception as e:
        logger.error(f"Error executing flow: {e}")
        logger.error(traceback.format_exc())
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }

def main():
    """Main entry point for the script."""
    logger.info("Starting flow execution script")
    
    # Set up the environment
    setup_environment()
    
    # Parse input arguments
    flow_config = parse_arguments()
    if not flow_config:
        # Return error response if parsing failed
        error_response = {
            "status": "error",
            "error": "Failed to parse flow configuration",
            "traceback": "No valid JSON configuration provided"
        }
        print(json.dumps(error_response))
        sys.exit(1)
    
    # Execute the flow
    results = execute_flow(flow_config)
    
    # Output results as JSON (which will be captured by the Node.js process)
    print(json.dumps(results))
    
    # Exit with appropriate status code
    if results.get("status") == "error":
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()