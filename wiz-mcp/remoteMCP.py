import boto3
import json
import base64
import subprocess
from botocore.exceptions import ClientError
from botocore.auth import SigV4Auth
from dotenv import load_dotenv

load_dotenv()

def test_with_aws_cli():
    """Test using the official AWS CLI method from Wiz documentation"""
    agent_runtime_arn = "arn:aws:bedrock-agentcore:us-east-1:148761662843:runtime/hosted_agent_81uak-ooea6W8teV"
    
    print("🔍 Testing with official AWS CLI method (from Wiz docs)...")
    print(f"Agent Runtime ARN: {agent_runtime_arn}\n")
    
    # Exact payload format from Wiz documentation
    payload = {
        "jsonrpc": "2.0", 
        "id": 1, 
        "method": "tools/list", 
        "params": { 
            "_meta": { 
                "progressToken": 1
            }
        }
    }
    
    payload_json = json.dumps(payload)
    payload_base64 = base64.b64encode(payload_json.encode()).decode()
    
    print(f"📤 Payload: {payload_json}")
    print(f"📦 Base64 encoded: {payload_base64[:50]}...\n")
    
    # Build AWS CLI command
    aws_command = [
        "aws", "bedrock-agentcore", "invoke-agent-runtime",
        "--agent-runtime-arn", agent_runtime_arn,
        "--content-type", "application/json", 
        "--accept", "application/json, text/event-stream",
        "--payload", payload_base64,
        "--qualifier", "DEFAULT",
        "output.json"
    ]
    
    print(f"🚀 Running AWS CLI command:")
    print(f"   {' '.join(aws_command[:5])} \\")
    print(f"     --agent-runtime-arn {agent_runtime_arn} \\")
    print(f"     --content-type 'application/json' \\")
    print(f"     --accept 'application/json, text/event-stream' \\")
    print(f"     --payload '{payload_base64[:30]}...' \\")
    print(f"     --qualifier 'DEFAULT' \\")
    print(f"     output.json\n")
    
    try:
        # Run the AWS CLI command
        result = subprocess.run(
            aws_command,
            capture_output=True,
            text=True,
            timeout=120  # 2 minute timeout
        )
        
        if result.returncode == 0:
            print("✅ AWS CLI command succeeded!")
            
            # Try to read the output file
            try:
                with open("output.json", "r") as f:
                    output = f.read()
                print(f"📄 Output file contents:")
                print(output)
                
                # Try to parse as JSON
                try:
                    output_json = json.loads(output)
                    print(f"\n📋 Parsed JSON response:")
                    print(json.dumps(output_json, indent=2))
                except json.JSONDecodeError:
                    print(f"\n📝 Raw output (not JSON):")
                    print(output)
                    
            except FileNotFoundError:
                print("❌ Output file not created")
                
        else:
            print(f"❌ AWS CLI command failed!")
            print(f"Return code: {result.returncode}")
            print(f"STDOUT: {result.stdout}")
            print(f"STDERR: {result.stderr}")
            
            if "AccessDenied" in result.stderr:
                print("\n🔍 Access denied - this suggests permissions issue")
            elif "ValidationException" in result.stderr:
                print("\n🔍 Validation error - check agent ARN and payload format")
            elif "ResourceNotFound" in result.stderr:
                print("\n🔍 Resource not found - check agent ARN")
                
    except subprocess.TimeoutExpired:
        print("⏱️  Command timed out after 2 minutes")
        print("This might indicate the agent is taking very long to respond")
    except Exception as e:
        print(f"❌ Error running command: {e}")

def test_with_boto3():
    """Test using boto3 with the correct payload format"""
    print("\n🔍 Testing with boto3 (exact Wiz payload format)...")
    
    try:
        # Create bedrock-agentcore client
        client = boto3.client('bedrock-agentcore', region_name='us-east-1')
        
        # Exact payload from Wiz docs
        payload = {
            "jsonrpc": "2.0", 
            "id": 1, 
            "method": "tools/list", 
            "params": { 
                "_meta": { 
                    "progressToken": 1
                }
            }
        }
        
        payload_json = json.dumps(payload)
        payload_base64 = base64.b64encode(payload_json.encode()).decode()
        
        print(f"📤 Using exact Wiz payload format")
        print(f"📦 Base64: {payload_base64[:50]}...")
        
        # Try to invoke using boto3
        response = client.invoke_agent_runtime(
            agentRuntimeArn="arn:aws:bedrock-agentcore:us-east-1:148761662843:runtime/hosted_agent_81uak-ooea6W8teV",
            contentType="application/json",
            accept="application/json, text/event-stream", 
            payload=payload_base64,
            qualifier="DEFAULT"
        )
        
        print("✅ Boto3 invoke succeeded!")
        print(f"Response keys: {list(response.keys())}")
        
        if 'body' in response:
            body = response['body']
            if hasattr(body, 'read'):
                content = body.read()
                print(f"📄 Response body: {content}")
            else:
                print(f"📄 Response body: {body}")
                
    except Exception as e:
        print(f"❌ Boto3 error: {e}")
        if hasattr(e, 'response'):
            print(f"Error response: {e.response}")

def main():
    print("Testing Wiz MCP agent using official documentation methods...\n")
    
    # Test both methods
    test_with_aws_cli()
    test_with_boto3()
    
    print(f"\n💡 If both methods fail, the issue might be:")
    print(f"   1. Missing WIZ_CLIENT_ID and WIZ_CLIENT_SECRET environment variables in agent")
    print(f"   2. Agent not properly configured during deployment")
    print(f"   3. Agent still starting up (cold start)")

if __name__ == "__main__":
    main()