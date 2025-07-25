#!/usr/bin/env node

import readline from "readline"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import SecurityAnalyzer from "../src/security-analyzer.js"
import dotenv from "dotenv"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class SecureCodeAIDemo {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    this.analyzer = new SecurityAnalyzer(process.env.OPENAI_API_KEY, process.env.AGENT_ARN, process.env.BEARER_TOKEN)

    this.scenarios = [
      {
        name: "S3 Bucket for User Uploads",
        request: "Create an S3 bucket for storing user uploaded files",
        resourceType: "S3_BUCKET",
      },
      {
        name: "RDS Database for User Data",
        request: "Create a PostgreSQL RDS database for storing user data",
        resourceType: "RDS_INSTANCE",
      },
      {
        name: "Lambda Function for API",
        request: "Create a Lambda function to handle API requests",
        resourceType: "LAMBDA_FUNCTION",
      },
      {
        name: "EC2 Instance for Web Server",
        request: "Create an EC2 instance to host a web application",
        resourceType: "EC2_INSTANCE",
      },
    ]
  }

  async start() {
    console.log("🛡️  Welcome to SecureCodeAI Demo")
    console.log("=====================================\n")

    console.log("Initializing security analyzer...")
    const initialized = await this.analyzer.initialize()

    if (!initialized) {
      console.log("⚠️  Warning: Using mock data (MCP connection failed)")
    } else {
      console.log("✅ Connected to Wiz security data")
    }

    await this.showMainMenu()
  }

  async showMainMenu() {
    console.log("\n📋 Choose a demo option:")
    console.log("1. Interactive Mode - Enter your own request")
    console.log("2. Run All Scenarios - See predefined examples")
    console.log("3. Generate Report - Create markdown report")
    console.log("4. Exit")

    const choice = await this.askQuestion("\nEnter your choice (1-4): ")

    switch (choice.trim()) {
      case "1":
        await this.interactiveMode()
        break
      case "2":
        await this.runAllScenarios()
        break
      case "3":
        await this.generateReport()
        break
      case "4":
        console.log("👋 Goodbye!")
        this.rl.close()
        return
      default:
        console.log("Invalid choice. Please try again.")
        await this.showMainMenu()
    }
  }

  async interactiveMode() {
    console.log("\n🤖 Interactive SecureCodeAI Mode")
    console.log("================================\n")

    const userRequest = await this.askQuestion("What infrastructure would you like to create? ")

    if (!userRequest.trim()) {
      console.log("Please enter a valid request.")
      return await this.interactiveMode()
    }

    console.log("\n🔄 Analyzing your request and generating secure code...\n")

    const result = await this.analyzer.analyzeCodeRequest(userRequest)
    await this.displayComparison(result)

    const again = await this.askQuestion("\nWould you like to try another request? (y/n): ")
    if (again.toLowerCase().startsWith("y")) {
      await this.interactiveMode()
    } else {
      await this.showMainMenu()
    }
  }

  async runAllScenarios() {
    console.log("\n🎯 Running All Demo Scenarios")
    console.log("=============================\n")

    for (let i = 0; i < this.scenarios.length; i++) {
      const scenario = this.scenarios[i]
      console.log(`\n📍 Scenario ${i + 1}: ${scenario.name}`)
      console.log("-".repeat(50))

      const result = await this.analyzer.analyzeCodeRequest(scenario.request, scenario.resourceType)
      await this.displayComparison(result)

      if (i < this.scenarios.length - 1) {
        await this.askQuestion("\nPress Enter to continue to next scenario...")
      }
    }

    await this.askQuestion("\nPress Enter to return to main menu...")
    await this.showMainMenu()
  }

  async displayComparison(result) {
    const { userRequest, securityContext, vanillaCode, secureCode, analysis, improvements } = result

    console.log(`📝 Request: ${userRequest}`)
    console.log(
      `🔍 Security Context: ${securityContext.summary.totalIssues} issues, ${securityContext.summary.totalThreats} threats`,
    )
    console.log(`🎯 Common Patterns: ${securityContext.summary.commonPatterns.join(", ")}\n`)

    // Show vanilla code
    console.log("❌ VANILLA AI CODE (Generic):")
    console.log("─".repeat(40))
    console.log(vanillaCode)
    console.log("\n")

    // Show secure code
    console.log("✅ SECURECODAI CODE (Security-Enhanced):")
    console.log("─".repeat(40))
    console.log(secureCode)
    console.log("\n")

    // Show improvements
    console.log("🛡️  SECURITY IMPROVEMENTS:")
    console.log("─".repeat(40))
    console.log(`Total Improvements: ${improvements.total}`)
    console.log(`Security Enhancements: ${improvements.categories.security}`)
    console.log(`Vulnerabilities Prevented: ${improvements.categories.vulnerabilities}`)
    console.log(`Best Practices Added: ${improvements.categories.bestPractices}\n`)

    if (analysis.securityImprovements.length > 0) {
      console.log("🔒 Security Enhancements:")
      analysis.securityImprovements.forEach((improvement) => {
        console.log(`  • ${improvement}`)
      })
      console.log("")
    }

    if (analysis.vulnerabilitiesPrevented.length > 0) {
      console.log("🚫 Vulnerabilities Prevented:")
      analysis.vulnerabilitiesPrevented.forEach((vuln) => {
        console.log(`  • ${vuln}`)
      })
      console.log("")
    }

    if (analysis.bestPracticesAdded.length > 0) {
      console.log("⭐ Best Practices Added:")
      analysis.bestPracticesAdded.forEach((practice) => {
        console.log(`  • ${practice}`)
      })
      console.log("")
    }
  }

  async generateReport() {
    console.log("\n📊 Generating Comprehensive Report")
    console.log("==================================\n")

    const results = []

    for (const scenario of this.scenarios) {
      console.log(`Processing: ${scenario.name}...`)
      const result = await this.analyzer.analyzeCodeRequest(scenario.request, scenario.resourceType)
      results.push(result)
    }

    const report = this.buildMarkdownReport(results)
    const reportPath = path.join(__dirname, "security-report.md")

    await fs.writeFile(reportPath, report)
    console.log(`\n✅ Report generated: ${reportPath}`)

    await this.askQuestion("Press Enter to return to main menu...")
    await this.showMainMenu()
  }

  buildMarkdownReport(results) {
    let report = `# SecureCodeAI Security Analysis Report\n\n`
    report += `Generated: ${new Date().toISOString()}\n\n`

    // Executive Summary
    const totalImprovements = results.reduce((sum, r) => sum + r.improvements.total, 0)
    const totalVulnerabilities = results.reduce((sum, r) => sum + r.improvements.categories.vulnerabilities, 0)

    report += `## Executive Summary\n\n`
    report += `- **Total Scenarios Analyzed**: ${results.length}\n`
    report += `- **Security Improvements Made**: ${totalImprovements}\n`
    report += `- **Vulnerabilities Prevented**: ${totalVulnerabilities}\n`
    report += `- **Average Security Score Improvement**: ${Math.round((totalImprovements / results.length) * 10)}%\n\n`

    // Detailed Analysis
    results.forEach((result, index) => {
      report += `## Scenario ${index + 1}: ${result.userRequest}\n\n`

      report += `### Security Context\n`
      report += `- Total Issues: ${result.securityContext.summary.totalIssues}\n`
      report += `- Critical Issues: ${result.securityContext.summary.criticalIssues}\n`
      report += `- Common Patterns: ${result.securityContext.summary.commonPatterns.join(", ")}\n\n`

      report += `### Vanilla AI Code\n\`\`\`hcl\n${result.vanillaCode}\n\`\`\`\n\n`

      report += `### SecureCodeAI Enhanced Code\n\`\`\`hcl\n${result.secureCode}\n\`\`\`\n\n`

      report += `### Security Improvements\n`
      if (result.analysis.securityImprovements.length > 0) {
        result.analysis.securityImprovements.forEach((improvement) => {
          report += `- ✅ ${improvement}\n`
        })
      }
      if (result.analysis.vulnerabilitiesPrevented.length > 0) {
        result.analysis.vulnerabilitiesPrevented.forEach((vuln) => {
          report += `- 🚫 ${vuln}\n`
        })
      }
      report += `\n---\n\n`
    })

    return report
  }

  askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve)
    })
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new SecureCodeAIDemo()
  demo.start().catch(console.error)
}

export default SecureCodeAIDemo
