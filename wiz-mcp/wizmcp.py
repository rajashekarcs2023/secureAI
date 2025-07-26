import asyncio
import os
import sys
import json
import traceback
from dotenv import load_dotenv

load_dotenv()

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async def main():
    agent_arn = os.getenv('AGENT_ARN')
    bearer_token = os.getenv('BEARER_TOKEN')
    if not agent_arn or not bearer_token:
        print("Error: AGENT_ARN or BEARER_TOKEN environment variable is not set")
        sys.exit(1)
    
    encoded_arn = agent_arn.replace(':', '%3A').replace('/', '%2F')
    mcp_url = f"https://bedrock-agentcore.us-east-1.amazonaws.com/runtimes/{encoded_arn}/invocations?qualifier=DEFAULT"
    headers = {
        "authorization": f"Bearer {bearer_token}",
        "Content-Type": "application/json"
    }
    
    print(f"Invoking: {mcp_url}")
    print(f"Using bearer token: {bearer_token[:20]}...")
    
    # Check if token looks like an access key vs session token
    if bearer_token.startswith('AKIA') or bearer_token.startswith('ASIA'):
        print("⚠️  WARNING: Your token looks like an AWS Access Key ID, not a session token.")
        print("   For Bedrock agent invocation, you typically need a session token.")
        print("   Session tokens are much longer and start with characters like 'IQoJb3JpZ2luX2VjE'")
    
    print()

    try:
        async with streamablehttp_client(mcp_url, headers, timeout=120, terminate_on_close=False) as (
            read_stream,
            write_stream,
            _,
        ):
            print("✅ Successfully established connection streams")
            async with ClientSession(read_stream, write_stream) as session:
                print("✅ Created MCP client session")
                await session.initialize()
                print("✅ Session initialized")
                tool_result = await session.list_tools()
                print("✅ Retrieved tools list")
                print("\nTools available:")
                print(json.dumps(tool_result, indent=2))
    except Exception as e:
        print(f"❌ Error connecting to MCP server: {e}")
        print("\nDetailed error traceback:")
        traceback.print_exc()
        
        # Provide specific guidance based on error
        if "401" in str(e) or "Unauthorized" in str(e):
            print("\n🔍 This looks like an authentication error. Try:")
            print("   1. Make sure you're using a session token, not an access key")
            print("   2. Get a session token with: aws sts get-session-token")
            print("   3. Use the SessionToken value from the response")
        elif "403" in str(e) or "Forbidden" in str(e):
            print("\n🔍 This looks like a permissions error. Check:")
            print("   1. Your AWS credentials have bedrock:InvokeAgent permission")
            print("   2. The agent ARN is correct")
        elif "timeout" in str(e).lower():
            print("\n🔍 This looks like a timeout. Try:")
            print("   1. Check your internet connection")
            print("   2. Verify the agent ARN and region are correct")

asyncio.run(main())