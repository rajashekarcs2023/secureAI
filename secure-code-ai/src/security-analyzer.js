import OpenAI from "openai"
import MCPClient from "./mcp-client.js"

class SecurityAnalyzer {
  constructor(openaiApiKey, agentArn, bearerToken) {
    this.openai = new OpenAI({ apiKey: openaiApiKey })
    this.mcpClient = new MCPClient(agentArn, bearerToken)
    this.initialized = false
  }

  async initialize() {
    try {
      this.initialized = await this.mcpClient.initialize()
      return this.initialized
    } catch (error) {
      console.error("Failed to initialize SecurityAnalyzer:", error.message)
      this.initialized = false
      return false
    }
  }

  async analyzeCodeRequest(userRequest, resourceType = null) {
    console.log(`\n🔍 Analyzing request: "${userRequest}"`)

    // Get security context from Wiz
    const securityContext = await this.mcpClient.getSecurityContext(resourceType)

    // Generate both vanilla and security-enhanced code
    const [vanillaCode, secureCode] = await Promise.all([
      this.generateVanillaCode(userRequest),
      this.generateSecureCode(userRequest, securityContext),
    ])

    // Analyze the differences
    const analysis = this.compareCodeSecurity(vanillaCode, secureCode, securityContext)

    return {
      userRequest,
      resourceType,
      securityContext,
      vanillaCode,
      secureCode,
      analysis,
      improvements: this.extractImprovements(analysis),
    }
  }

  async generateVanillaCode(userRequest) {
    const prompt = `Generate Terraform code for: ${userRequest}

Requirements:
- Use standard Terraform syntax
- Include basic configuration
- Focus on functionality over security
- Keep it simple and straightforward`

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      })

      return response.choices[0].message.content
    } catch (error) {
      console.error("Failed to generate vanilla code:", error.message)
      return this.getMockVanillaCode(userRequest)
    }
  }

  async generateSecureCode(userRequest, securityContext) {
    const securityPrompt = this.buildSecurityPrompt(userRequest, securityContext)

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are SecureCodeAI, an expert in generating secure infrastructure code. Always prioritize security best practices and avoid known vulnerability patterns.",
          },
          {
            role: "user",
            content: securityPrompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 1500,
      })

      return response.choices[0].message.content
    } catch (error) {
      console.error("Failed to generate secure code:", error.message)
      return this.getMockSecureCode(userRequest)
    }
  }

  buildSecurityPrompt(userRequest, securityContext) {
    const { summary, issues, threats } = securityContext

    let prompt = `Generate secure Terraform code for: ${userRequest}\n\n`

    prompt += `🚨 CRITICAL SECURITY CONTEXT FROM YOUR ORGANIZATION:\n`
    prompt += `- Total security issues: ${summary.totalIssues}\n`
    prompt += `- Critical issues: ${summary.criticalIssues}\n`
    prompt += `- High severity issues: ${summary.highIssues}\n`
    prompt += `- Common vulnerability patterns: ${summary.commonPatterns.join(", ")}\n\n`

    if (issues.length > 0) {
      prompt += `🔍 SPECIFIC VULNERABILITIES TO AVOID:\n`
      issues.slice(0, 5).forEach((issue) => {
        prompt += `- ${issue.title}: ${issue.description}\n`
      })
      prompt += `\n`
    }

    if (threats.length > 0) {
      prompt += `⚠️ ACTIVE THREATS IN YOUR ENVIRONMENT:\n`
      threats.slice(0, 3).forEach((threat) => {
        prompt += `- ${threat.title}: ${threat.attack_vector}\n`
      })
      prompt += `\n`
    }

    prompt += `SECURITY REQUIREMENTS:\n`
    prompt += `1. Implement encryption at rest and in transit\n`
    prompt += `2. Follow principle of least privilege\n`
    prompt += `3. Avoid public access unless explicitly required\n`
    prompt += `4. Include proper access controls and monitoring\n`
    prompt += `5. Address the specific vulnerability patterns found in your org\n`
    prompt += `6. Add security group restrictions\n`
    prompt += `7. Include backup and versioning where applicable\n\n`

    prompt += `Generate production-ready, secure Terraform code that addresses these concerns.`

    return prompt
  }

  compareCodeSecurity(vanillaCode, secureCode, securityContext) {
    const analysis = {
      securityImprovements: [],
      vulnerabilitiesPrevented: [],
      complianceEnhancements: [],
      bestPracticesAdded: [],
    }

    // Analyze security improvements
    if (secureCode.includes("encryption") && !vanillaCode.includes("encryption")) {
      analysis.securityImprovements.push("Added encryption configuration")
    }

    if (secureCode.includes("public_access_block") && !vanillaCode.includes("public_access_block")) {
      analysis.securityImprovements.push("Blocked public access")
    }

    if (secureCode.includes("versioning") && !vanillaCode.includes("versioning")) {
      analysis.securityImprovements.push("Enabled versioning for data protection")
    }

    if (secureCode.includes("kms") && !vanillaCode.includes("kms")) {
      analysis.securityImprovements.push("Added KMS encryption")
    }

    // Map to prevented vulnerabilities
    securityContext.issues.forEach((issue) => {
      if (issue.title.includes("public") && secureCode.includes("public_access_block")) {
        analysis.vulnerabilitiesPrevented.push(`Prevented: ${issue.title}`)
      }
      if (issue.title.includes("encryption") && secureCode.includes("encryption")) {
        analysis.vulnerabilitiesPrevented.push(`Prevented: ${issue.title}`)
      }
    })

    // Best practices
    if (secureCode.includes("lifecycle")) {
      analysis.bestPracticesAdded.push("Lifecycle management for cost optimization")
    }

    if (secureCode.includes("monitoring") || secureCode.includes("logging")) {
      analysis.bestPracticesAdded.push("Added monitoring and logging")
    }

    return analysis
  }

  extractImprovements(analysis) {
    const totalImprovements =
      analysis.securityImprovements.length +
      analysis.vulnerabilitiesPrevented.length +
      analysis.bestPracticesAdded.length

    return {
      total: totalImprovements,
      categories: {
        security: analysis.securityImprovements.length,
        vulnerabilities: analysis.vulnerabilitiesPrevented.length,
        bestPractices: analysis.bestPracticesAdded.length,
      },
      details: analysis,
    }
  }

  getMockVanillaCode(userRequest) {
    if (userRequest.toLowerCase().includes("s3")) {
      return `resource "aws_s3_bucket" "user_uploads" {
  bucket = "my-app-uploads"
  acl    = "public-read"
  
  tags = {
    Name = "User Uploads"
  }
}`
    }

    return `# Basic Terraform configuration for: ${userRequest}
resource "aws_instance" "example" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"
  
  tags = {
    Name = "Example Instance"
  }
}`
  }

  getMockSecureCode(userRequest) {
    if (userRequest.toLowerCase().includes("s3")) {
      return `# Secure S3 bucket configuration
resource "aws_s3_bucket" "user_uploads" {
  bucket = "my-app-uploads-\${random_id.bucket_suffix.hex}"
  
  tags = {
    Name        = "User Uploads"
    Environment = "production"
    Security    = "encrypted"
  }
}

resource "aws_s3_bucket_public_access_block" "user_uploads" {
  bucket = aws_s3_bucket.user_uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "user_uploads" {
  bucket = aws_s3_bucket.user_uploads.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3_key.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_versioning" "user_uploads" {
  bucket = aws_s3_bucket.user_uploads.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}`
    }

    return `# Secure infrastructure configuration
resource "aws_instance" "secure_instance" {
  ami           = "ami-12345678"
  instance_type = "t3.micro"
  
  vpc_security_group_ids = [aws_security_group.secure_sg.id]
  
  root_block_device {
    encrypted = true
  }
  
  metadata_options {
    http_tokens = "required"
  }
  
  tags = {
    Name = "Secure Instance"
    Security = "hardened"
  }
}

resource "aws_security_group" "secure_sg" {
  name_prefix = "secure-sg-"
  
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}`
  }
}

export default SecurityAnalyzer
