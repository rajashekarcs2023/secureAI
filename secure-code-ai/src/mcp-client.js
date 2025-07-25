import fetch from "node-fetch"

class MCPClient {
  constructor(agentArn, bearerToken) {
    this.agentArn = agentArn
    this.bearerToken = bearerToken
    this.encodedArn = agentArn.replace(/:/g, "%3A").replace(/\//g, "%2F")
    this.mcpUrl = `https://bedrock-agentcore.us-east-1.amazonaws.com/runtimes/${this.encodedArn}/invocations?qualifier=DEFAULT`
    this.headers = {
      authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    }
  }

  async initialize() {
    try {
      console.log(`Connecting to MCP server: ${this.mcpUrl}`)
      console.log(`Using bearer token: ${this.bearerToken.substring(0, 20)}...`)

      // Initialize connection and list available tools
      const tools = await this.listTools()
      console.log(
        "Available Wiz tools:",
        tools.map((t) => t.name),
      )
      return true
    } catch (error) {
      console.error("Failed to initialize MCP client:", error.message)
      return false
    }
  }

  async makeRequest(payload) {
    try {
      const response = await fetch(this.mcpUrl, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(payload),
        timeout: 120000,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error("MCP request failed:", error.message)
      throw error
    }
  }

  async listTools() {
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    }

    const response = await this.makeRequest(payload)
    return response.result?.tools || []
  }

  async callTool(toolName, arguments_) {
    const payload = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: arguments_,
      },
    }

    const response = await this.makeRequest(payload)
    return response.result
  }

  // Wiz-specific tool wrappers
  async wizSearch(query, filters = {}) {
    try {
      return await this.callTool("wiz_search", {
        query,
        filters,
        limit: 100,
      })
    } catch (error) {
      console.error("Wiz search failed:", error.message)
      return this.getMockSearchResults(query)
    }
  }

  async wizGetIssues(severity = "HIGH", limit = 50) {
    try {
      return await this.callTool("wiz_get_issues", {
        severity,
        limit,
        status: "OPEN",
      })
    } catch (error) {
      console.error("Wiz get issues failed:", error.message)
      return this.getMockIssues(severity)
    }
  }

  async wizGetThreats(resourceType = null) {
    try {
      return await this.callTool("wiz_get_threats", {
        resource_type: resourceType,
        limit: 50,
      })
    } catch (error) {
      console.error("Wiz get threats failed:", error.message)
      return this.getMockThreats(resourceType)
    }
  }

  // High-level security context functions
  async getSecurityContext(resourceType = null) {
    try {
      const [issues, threats, searchResults] = await Promise.all([
        this.wizGetIssues("HIGH"),
        this.wizGetThreats(resourceType),
        resourceType ? this.wizSearch(`resource_type:${resourceType}`) : this.wizSearch("vulnerability"),
      ])

      return {
        issues: issues.content || issues,
        threats: threats.content || threats,
        searchResults: searchResults.content || searchResults,
        summary: this.generateSecuritySummary(issues, threats, searchResults),
      }
    } catch (error) {
      console.error("Failed to get security context:", error.message)
      return this.getMockSecurityContext(resourceType)
    }
  }

  async getVulnerabilities(resourceType = null) {
    const context = await this.getSecurityContext(resourceType)
    return context.issues.filter((issue) => issue.type === "VULNERABILITY" || issue.severity === "CRITICAL")
  }

  async getThreats(resourceType = null) {
    const context = await this.getSecurityContext(resourceType)
    return context.threats
  }

  generateSecuritySummary(issues, threats, searchResults) {
    const issueCount = Array.isArray(issues) ? issues.length : issues.content?.length || 0
    const threatCount = Array.isArray(threats) ? threats.length : threats.content?.length || 0

    return {
      totalIssues: issueCount,
      totalThreats: threatCount,
      criticalIssues: this.countBySeverity(issues, "CRITICAL"),
      highIssues: this.countBySeverity(issues, "HIGH"),
      commonPatterns: this.extractCommonPatterns(issues, threats),
    }
  }

  countBySeverity(issues, severity) {
    const issueArray = Array.isArray(issues) ? issues : issues.content || []
    return issueArray.filter((issue) => issue.severity === severity).length
  }

  extractCommonPatterns(issues, threats) {
    // Extract common vulnerability patterns from the data
    const patterns = new Set()
    const allItems = [
      ...(Array.isArray(issues) ? issues : issues.content || []),
      ...(Array.isArray(threats) ? threats : threats.content || []),
    ]

    allItems.forEach((item) => {
      if (item.title?.includes("S3")) patterns.add("S3_MISCONFIGURATION")
      if (item.title?.includes("public")) patterns.add("PUBLIC_ACCESS")
      if (item.title?.includes("encryption")) patterns.add("MISSING_ENCRYPTION")
      if (item.title?.includes("IAM")) patterns.add("IAM_OVERPRIVILEGED")
      if (item.title?.includes("security group")) patterns.add("SECURITY_GROUP_OPEN")
    })

    return Array.from(patterns)
  }

  // Mock data for when live services aren't available
  getMockSearchResults(query) {
    return {
      content: [
        {
          id: "mock-1",
          title: "Public S3 bucket detected",
          severity: "HIGH",
          resource_type: "S3_BUCKET",
          description: "S3 bucket allows public read access",
        },
        {
          id: "mock-2",
          title: "Unencrypted RDS instance",
          severity: "MEDIUM",
          resource_type: "RDS_INSTANCE",
          description: "Database instance lacks encryption at rest",
        },
      ],
    }
  }

  getMockIssues(severity) {
    return {
      content: [
        {
          id: "issue-1",
          title: "S3 bucket with public read access",
          severity: "CRITICAL",
          type: "VULNERABILITY",
          resource_type: "S3_BUCKET",
          description: "Bucket policy allows public access to sensitive data",
          remediation: "Remove public read permissions and implement proper access controls",
        },
        {
          id: "issue-2",
          title: "Security group allows 0.0.0.0/0 access",
          severity: "HIGH",
          type: "MISCONFIGURATION",
          resource_type: "SECURITY_GROUP",
          description: "Security group rule allows unrestricted inbound access",
          remediation: "Restrict source IP ranges to specific networks",
        },
        {
          id: "issue-3",
          title: "IAM user with excessive permissions",
          severity: "HIGH",
          type: "VULNERABILITY",
          resource_type: "IAM_USER",
          description: "User has administrative privileges beyond requirements",
          remediation: "Apply principle of least privilege",
        },
      ],
    }
  }

  getMockThreats(resourceType) {
    return {
      content: [
        {
          id: "threat-1",
          title: "Data exfiltration risk via public S3",
          severity: "CRITICAL",
          resource_type: "S3_BUCKET",
          attack_vector: "Public bucket enumeration",
          impact: "Sensitive data exposure",
        },
        {
          id: "threat-2",
          title: "Lateral movement via overprivileged IAM",
          severity: "HIGH",
          resource_type: "IAM_ROLE",
          attack_vector: "Privilege escalation",
          impact: "Account compromise",
        },
      ],
    }
  }

  getMockSecurityContext(resourceType) {
    return {
      issues: this.getMockIssues("HIGH").content,
      threats: this.getMockThreats(resourceType).content,
      searchResults: this.getMockSearchResults("vulnerability").content,
      summary: {
        totalIssues: 12,
        totalThreats: 5,
        criticalIssues: 3,
        highIssues: 7,
        commonPatterns: ["S3_MISCONFIGURATION", "PUBLIC_ACCESS", "MISSING_ENCRYPTION", "IAM_OVERPRIVILEGED"],
      },
    }
  }
}

export default MCPClient
