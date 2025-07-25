# SecureCodeAI

AI-powered secure code generation using Wiz MCP integration. Generate infrastructure code that automatically avoids your organization's known security vulnerabilities.

## 🎯 Value Proposition

**"AI that knows your actual security weaknesses generates better, more secure code."**

SecureCodeAI integrates with your Wiz security data to provide context-aware code generation that:
- Prevents known vulnerability patterns in your organization
- Follows your security policies automatically  
- Generates secure-by-default infrastructure code
- Provides side-by-side comparisons showing security improvements

## 🏗️ Architecture

\`\`\`
User Request → Wiz MCP Client → Security Context → AI Enhancement → Secure Code
     ↓              ↓               ↓              ↓            ↓
"Create S3"    Get org vulns    "12 public     Enhanced      Secure S3
               & threats        buckets found"  prompt        with encryption
\`\`\`

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- OpenAI API key
- Wiz MCP credentials (AGENT_ARN and BEARER_TOKEN)

### Installation

1. Clone the repository:
\`\`\`bash
git clone <repository-url>
cd securecodai
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Configure environment variables:
\`\`\`bash
cp .env.example .env
# Edit .env with your API keys
\`\`\`

4. Run the demo:
\`\`\`bash
npm start
\`\`\`

## 🎮 Demo Modes

### 1. Interactive CLI Demo
\`\`\`bash
npm start
\`\`\`
- Enter custom infrastructure requests
- See real-time security analysis
- Compare vanilla AI vs SecureCodeAI output

### 2. Web Interface
\`\`\`bash
npm run web
\`\`\`
- Visual VS Code-like interface
- Side-by-side code comparison
- Security metrics dashboard

### 3. Batch Scenarios
Run all predefined scenarios:
- S3 bucket creation
- RDS database setup
- Lambda function deployment
- EC2 instance configuration

## 📊 Example Output

### User Request: "Create an S3 bucket for user uploads"

**Vanilla AI Code:**
```hcl
resource "aws_s3_bucket" "user_uploads" {
  bucket = "my-app-uploads"
  acl    = "public-read"  # ⚠️ SECURITY RISK
}
