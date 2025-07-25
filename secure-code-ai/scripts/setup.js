#!/usr/bin/env node

import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import readline from "readline"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class SetupScript {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
  }

  async run() {
    console.log("🚀 SecureCodeAI Setup Script")
    console.log("============================\n")

    try {
      await this.checkPrerequisites()
      await this.setupEnvironment()
      await this.validateConfiguration()
      console.log("\n✅ Setup completed successfully!")
      console.log("\nNext steps:")
      console.log("1. Run: npm start")
      console.log("2. Or try the web interface: npm run web")
    } catch (error) {
      console.error("\n❌ Setup failed:", error.message)
      process.exit(1)
    } finally {
      this.rl.close()
    }
  }

  async checkPrerequisites() {
    console.log("🔍 Checking prerequisites...")

    // Check Node.js version
    const nodeVersion = process.version
    const majorVersion = Number.parseInt(nodeVersion.slice(1).split(".")[0])

    if (majorVersion < 18) {
      throw new Error(`Node.js 18+ required, found ${nodeVersion}`)
    }
    console.log(`  ✅ Node.js ${nodeVersion}`)

    // Check if package.json exists
    try {
      await fs.access(path.join(__dirname, "..", "package.json"))
      console.log("  ✅ package.json found")
    } catch {
      throw new Error("package.json not found. Run this script from the project root.")
    }

    // Check if dependencies are installed
    try {
      await fs.access(path.join(__dirname, "..", "node_modules"))
      console.log("  ✅ Dependencies installed")
    } catch {
      console.log("  ⚠️  Dependencies not found. Run: npm install")
    }
  }

  async setupEnvironment() {
    console.log("\n🔧 Setting up environment...")

    const envPath = path.join(__dirname, "..", ".env")
    const envExamplePath = path.join(__dirname, "..", ".env.example")

    try {
      await fs.access(envPath)
      console.log("  ✅ .env file already exists")
      return
    } catch {
      // .env doesn't exist, create it
    }

    try {
      const envExample = await fs.readFile(envExamplePath, "utf8")
      await fs.writeFile(envPath, envExample)
      console.log("  ✅ Created .env file from template")
    } catch {
      // Create basic .env file
      const basicEnv = `# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Wiz MCP Configuration  
AGENT_ARN=your_agent_arn_here
BEARER_TOKEN=your_bearer_token_here

# Optional: Mock mode
USE_MOCK_DATA=false
`
      await fs.writeFile(envPath, basicEnv)
      console.log("  ✅ Created basic .env file")
    }

    console.log("\n📝 Please edit .env file with your API credentials:")
    console.log("  - OPENAI_API_KEY: Your OpenAI API key")
    console.log("  - AGENT_ARN: Your Wiz MCP Agent ARN")
    console.log("  - BEARER_TOKEN: Your Wiz MCP Bearer Token")

    const proceed = await this.askQuestion("\nHave you updated the .env file? (y/n): ")
    if (!proceed.toLowerCase().startsWith("y")) {
      throw new Error("Please update .env file with your credentials")
    }
  }

  async validateConfiguration() {
    console.log("\n✅ Validating configuration...")

    try {
      const envContent = await fs.readFile(path.join(__dirname, "..", ".env"), "utf8")

      const hasOpenAI = envContent.includes("OPENAI_API_KEY=") && !envContent.includes("your_openai_api_key_here")
      const hasAgentArn = envContent.includes("AGENT_ARN=") && !envContent.includes("your_agent_arn_here")
      const hasBearerToken = envContent.includes("BEARER_TOKEN=") && !envContent.includes("your_bearer_token_here")

      if (hasOpenAI) {
        console.log("  ✅ OpenAI API key configured")
      } else {
        console.log("  ⚠️  OpenAI API key not configured (will use mock responses)")
      }

      if (hasAgentArn && hasBearerToken) {
        console.log("  ✅ Wiz MCP credentials configured")
      } else {
        console.log("  ⚠️  Wiz MCP credentials not configured (will use mock data)")
      }
    } catch (error) {
      console.log("  ⚠️  Could not validate configuration:", error.message)
    }
  }

  askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve)
    })
  }
}

// Run setup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new SetupScript()
  setup.run().catch(console.error)
}

export default SetupScript
