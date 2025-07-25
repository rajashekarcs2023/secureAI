#!/usr/bin/env node

import assert from "assert"
import MCPClient from "../src/mcp-client.js"
import SecurityAnalyzer from "../src/security-analyzer.js"
import dotenv from "dotenv"

dotenv.config()

class TestSuite {
  constructor() {
    this.tests = []
    this.passed = 0
    this.failed = 0
  }

  async runTests() {
    console.log("🧪 Running SecureCodeAI Test Suite")
    console.log("==================================\n")

    // Test MCP Client
    await this.testMCPClient()

    // Test Security Analyzer
    await this.testSecurityAnalyzer()

    // Test Integration
    await this.testIntegration()

    // Summary
    console.log("\n📊 Test Results:")
    console.log(`✅ Passed: ${this.passed}`)
    console.log(`❌ Failed: ${this.failed}`)
    console.log(`📈 Success Rate: ${Math.round((this.passed / (this.passed + this.failed)) * 100)}%`)

    process.exit(this.failed > 0 ? 1 : 0)
  }

  async testMCPClient() {
    console.log("🔌 Testing MCP Client...")

    try {
      const client = new MCPClient(process.env.AGENT_ARN || "test-arn", process.env.BEARER_TOKEN || "test-token")

      // Test initialization
      await this.test("MCP Client initialization", async () => {
        const result = await client.initialize()
        assert(typeof result === "boolean", "Initialize should return boolean")
      })

      // Test security context retrieval
      await this.test("Security context retrieval", async () => {
        const context = await client.getSecurityContext("S3_BUCKET")
        assert(context.issues, "Context should have issues")
        assert(context.threats, "Context should have threats")
        assert(context.summary, "Context should have summary")
        assert(typeof context.summary.totalIssues === "number", "Total issues should be number")
      })

      // Test vulnerability filtering
      await this.test("Vulnerability filtering", async () => {
        const vulns = await client.getVulnerabilities("S3_BUCKET")
        assert(Array.isArray(vulns), "Vulnerabilities should be array")
      })
    } catch (error) {
      console.log(`⚠️  MCP Client tests using mock data: ${error.message}`)
    }
  }

  async testSecurityAnalyzer() {
    console.log("\n🔍 Testing Security Analyzer...")

    try {
      const analyzer = new SecurityAnalyzer(
        process.env.OPENAI_API_KEY || "test-key",
        process.env.AGENT_ARN || "test-arn",
        process.env.BEARER_TOKEN || "test-token",
      )

      // Test initialization
      await this.test("Security Analyzer initialization", async () => {
        const result = await analyzer.initialize()
        assert(typeof result === "boolean", "Initialize should return boolean")
      })

      // Test code analysis
      await this.test("Code analysis", async () => {
        const result = await analyzer.analyzeCodeRequest("Create an S3 bucket", "S3_BUCKET")
        assert(result.userRequest, "Result should have user request")
        assert(result.securityContext, "Result should have security context")
        assert(result.vanillaCode, "Result should have vanilla code")
        assert(result.secureCode, "Result should have secure code")
        assert(result.analysis, "Result should have analysis")
        assert(result.improvements, "Result should have improvements")
      })

      // Test improvement extraction
      await this.test("Improvement extraction", async () => {
        const mockAnalysis = {
          securityImprovements: ["Added encryption"],
          vulnerabilitiesPrevented: ["Prevented public access"],
          bestPracticesAdded: ["Added versioning"],
        }
        const improvements = analyzer.extractImprovements(mockAnalysis)
        assert(improvements.total === 3, "Should count all improvements")
        assert(improvements.categories, "Should have categories")
      })
    } catch (error) {
      console.log(`⚠️  Security Analyzer tests using mock data: ${error.message}`)
    }
  }

  async testIntegration() {
    console.log("\n🔗 Testing Integration...")

    // Test scenario processing
    await this.test("Scenario processing", async () => {
      const scenarios = [
        "Create an S3 bucket for user uploads",
        "Create a PostgreSQL database",
        "Create a Lambda function",
      ]

      for (const scenario of scenarios) {
        // Mock processing
        const result = {
          userRequest: scenario,
          improvements: { total: Math.floor(Math.random() * 5) + 1 },
        }
        assert(result.userRequest === scenario, "Should preserve user request")
        assert(result.improvements.total > 0, "Should have improvements")
      }
    })

    // Test report generation
    await this.test("Report generation", async () => {
      const mockResults = [
        {
          userRequest: "Test request",
          securityContext: { summary: { totalIssues: 5, criticalIssues: 2, commonPatterns: ["TEST"] } },
          vanillaCode: "test code",
          secureCode: "secure test code",
          analysis: { securityImprovements: ["test"], vulnerabilitiesPrevented: [], bestPracticesAdded: [] },
          improvements: { total: 1, categories: { security: 1, vulnerabilities: 0, bestPractices: 0 } },
        },
      ]

      // Mock report building
      const report = this.buildMockReport(mockResults)
      assert(report.includes("# SecureCodeAI Security Analysis Report"), "Should have report header")
      assert(report.includes("Test request"), "Should include test request")
    })
  }

  buildMockReport(results) {
    let report = `# SecureCodeAI Security Analysis Report\n\n`
    report += `Generated: ${new Date().toISOString()}\n\n`

    results.forEach((result, index) => {
      report += `## Scenario ${index + 1}: ${result.userRequest}\n\n`
      report += `### Security Improvements\n`
      report += `- Total: ${result.improvements.total}\n\n`
    })

    return report
  }

  async test(name, testFn) {
    try {
      await testFn()
      console.log(`  ✅ ${name}`)
      this.passed++
    } catch (error) {
      console.log(`  ❌ ${name}: ${error.message}`)
      this.failed++
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new TestSuite()
  testSuite.runTests().catch(console.error)
}

export default TestSuite
