// SecureCodeAI Backend - Node.js server orchestrating Claude + Wiz MCP
const express = require('express');
const cors = require('cors');
const { Client } = require('@anthropic-ai/sdk');
const { MCPClient } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

class SecureCodeAI {
    constructor() {
        this.app = express();
        this.anthropic = new Client({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        this.wizMCP = null;
        this.securityContext = new Map();
        this.vulnerabilityPatterns = new Map();
        this.setupMiddleware();
        this.setupRoutes();
        this.initializeMCP();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.static('public'));
    }

    async initializeMCP() {
        try {
            console.log('🔗 Connecting to Wiz MCP server...');
            
            // Connect to your deployed Wiz MCP server
            const wizEndpoint = process.env.WIZ_MCP_ENDPOINT || 
                'arn:aws:bedrock-agentcore:us-east-1:148761662843:runtime/hosted_agent_81uak-ooea6W8teV';
            
            // For now, simulate MCP connection - replace with actual AWS Bedrock AgentCore call
            this.wizMCP = {
                async callTool(name, args) {
                    // This would call your deployed Wiz MCP server
                    return await this.invokeWizMCP(name, args);
                }
            };

            // Load security context on startup
            await this.refreshSecurityContext();
            console.log('✅ Wiz MCP connected and security context loaded');
        } catch (error) {
            console.error('❌ Failed to initialize MCP:', error);
        }
    }

    async invokeWizMCP(toolName, args) {
        // This would use the AWS Bedrock AgentCore client to call your MCP server
        // For now, simulating the response structure
        const mockResponses = {
            'get_vulnerabilities': {
                vulnerabilities: [
                    {
                        id: 'WIZ-001',
                        severity: 'HIGH',
                        category: 'Insecure Configuration',
                        description: 'S3 bucket with public read access',
                        affectedResources: ['s3://company-data-bucket'],
                        pattern: 'aws_s3_bucket.*public-read',
                        remediation: 'Remove public-read ACL and use IAM policies'
                    },
                    {
                        id: 'WIZ-002', 
                        severity: 'CRITICAL',
                        category: 'Secrets Management',
                        description: 'Hardcoded API keys in infrastructure code',
                        pattern: 'api[_-]?key.*=.*["\'][a-zA-Z0-9]{20,}["\']',
                        remediation: 'Use AWS Secrets Manager or environment variables'
                    }
                ]
            },
            'get_threats': {
                threats: [
                    {
                        id: 'THREAT-001',
                        type: 'Data Exposure',
                        description: 'Publicly accessible database instances',
                        riskScore: 9.2
                    }
                ]
            }
        };

        return mockResponses[toolName] || { error: 'Tool not found' };
    }

    async refreshSecurityContext() {
        try {
            // Get current vulnerabilities from Wiz
            const vulns = await this.wizMCP.callTool('get_vulnerabilities', {});
            const threats = await this.wizMCP.callTool('get_threats', {});

            // Build security context map
            vulns.vulnerabilities?.forEach(vuln => {
                this.vulnerabilityPatterns.set(vuln.pattern, {
                    severity: vuln.severity,
                    description: vuln.description,
                    remediation: vuln.remediation,
                    category: vuln.category
                });
            });

            this.securityContext.set('lastUpdated', new Date());
            this.securityContext.set('vulnerabilityCount', vulns.vulnerabilities?.length || 0);
            this.securityContext.set('threatCount', threats.threats?.length || 0);

            console.log(`🛡️ Security context updated: ${vulns.vulnerabilities?.length} vulnerabilities, ${threats.threats?.length} threats`);
        } catch (error) {
            console.error('❌ Failed to refresh security context:', error);
        }
    }

    async analyzeCodeForVulnerabilities(code, language) {
        const vulnerabilities = [];
        
        for (const [pattern, vuln] of this.vulnerabilityPatterns) {
            const regex = new RegExp(pattern, 'gi');
            const matches = code.match(regex);
            
            if (matches) {
                vulnerabilities.push({
                    pattern: pattern,
                    matches: matches,
                    severity: vuln.severity,
                    description: vuln.description,
                    remediation: vuln.remediation,
                    line: this.findLineNumber(code, matches[0])
                });
            }
        }

        return vulnerabilities;
    }

    findLineNumber(code, match) {
        const lines = code.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(match)) {
                return i + 1;
            }
        }
        return 0;
    }

    buildSecurityPrompt(code, language, vulnerabilities) {
        const contextSummary = Array.from(this.vulnerabilityPatterns.entries())
            .map(([pattern, vuln]) => `- ${vuln.category}: ${vuln.description}`)
            .join('\n');

        return `You are SecureCodeAI, an AI pair programmer with real-time access to ${this.securityContext.get('vulnerabilityCount')} security vulnerabilities from this organization's Wiz security platform.

SECURITY CONTEXT FROM ORGANIZATION:
${contextSummary}

DETECTED VULNERABILITIES IN USER'S CODE:
${vulnerabilities.map(v => `⚠️ ${v.severity}: ${v.description} (Line ${v.line})\n   Fix: ${v.remediation}`).join('\n')}

CODE TO ANALYZE:
\`\`\`${language}
${code}
\`\`\`

Your mission:
1. 🛡️ SECURITY FIRST: Identify any patterns that match known vulnerabilities in this organization
2. 🔧 PROVIDE FIXES: Suggest secure alternatives based on the remediation guidance
3. 📚 EDUCATE: Explain why the secure approach prevents the specific vulnerabilities
4. ⚡ PROACTIVE: Suggest additional security improvements even if no direct matches found

Generate secure, production-ready code that avoids the vulnerability patterns identified in this organization's environment.`;
    }

    setupRoutes() {
        // Main endpoint for code analysis and suggestions
        this.app.post('/api/analyze', async (req, res) => {
            try {
                const { code, language, context } = req.body;

                // Analyze code for known vulnerabilities
                const vulnerabilities = await this.analyzeCodeForVulnerabilities(code, language);

                // Build security-aware prompt
                const securityPrompt = this.buildSecurityPrompt(code, language, vulnerabilities);

                // Get AI response with security context
                const response = await this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 4000,
                    messages: [
                        {
                            role: 'user',
                            content: securityPrompt
                        }
                    ]
                });

                res.json({
                    success: true,
                    vulnerabilities: vulnerabilities,
                    secureCode: response.content[0].text,
                    securityScore: this.calculateSecurityScore(vulnerabilities),
                    recommendations: this.generateRecommendations(vulnerabilities)
                });

            } catch (error) {
                console.error('Analysis error:', error);
                res.status(500).json({ error: 'Analysis failed', details: error.message });
            }
        });

        // Endpoint to refresh security context
        this.app.post('/api/refresh-security', async (req, res) => {
            try {
                await this.refreshSecurityContext();
                res.json({ 
                    success: true, 
                    vulnerabilities: this.securityContext.get('vulnerabilityCount'),
                    threats: this.securityContext.get('threatCount'),
                    lastUpdated: this.securityContext.get('lastUpdated')
                });
            } catch (error) {
                res.status(500).json({ error: 'Failed to refresh security context' });
            }
        });

        // Endpoint for feedback learning
        this.app.post('/api/feedback', async (req, res) => {
            try {
                const { code, suggestion, outcome, securityScanResults } = req.body;
                
                // Store feedback for learning (implement your learning logic here)
                await this.processFeedback(code, suggestion, outcome, securityScanResults);
                
                res.json({ success: true, message: 'Feedback recorded for learning' });
            } catch (error) {
                res.status(500).json({ error: 'Failed to process feedback' });
            }
        });

        // Health check endpoint
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'healthy',
                mcpConnected: !!this.wizMCP,
                securityContextLoaded: this.securityContext.size > 0,
                vulnerabilityPatterns: this.vulnerabilityPatterns.size
            });
        });
    }

    calculateSecurityScore(vulnerabilities) {
        if (vulnerabilities.length === 0) return 100;
        
        const severityWeights = { CRITICAL: 40, HIGH: 20, MEDIUM: 10, LOW: 5 };
        const totalDeductions = vulnerabilities.reduce((sum, vuln) => {
            return sum + (severityWeights[vuln.severity] || 5);
        }, 0);
        
        return Math.max(0, 100 - totalDeductions);
    }

    generateRecommendations(vulnerabilities) {
        const recommendations = [];
        const categories = new Set(vulnerabilities.map(v => v.category));
        
        categories.forEach(category => {
            switch(category) {
                case 'Insecure Configuration':
                    recommendations.push('🔒 Review all resource configurations for public access');
                    break;
                case 'Secrets Management':
                    recommendations.push('🔑 Implement proper secrets management (AWS Secrets Manager, HashiCorp Vault)');
                    break;
                default:
                    recommendations.push(`🛡️ Address ${category} vulnerabilities`);
            }
        });

        return recommendations;
    }

    async processFeedback(code, suggestion, outcome, securityScanResults) {
        // Implement learning logic here
        // This could:
        // 1. Store feedback in a database
        // 2. Analyze patterns in successful/failed suggestions
        // 3. Update vulnerability patterns based on real-world outcomes
        // 4. Improve the AI prompts based on feedback
        
        console.log('📊 Learning from feedback:', {
            codeLength: code.length,
            outcome: outcome,
            securityIssuesFound: securityScanResults?.issuesCount || 0
        });
    }

    start(port = 3001) {
        this.app.listen(port, () => {
            console.log(`🚀 SecureCodeAI Backend running on port ${port}`);
            console.log(`🛡️ Security context: ${this.vulnerabilityPatterns.size} vulnerability patterns loaded`);
        });
    }
}

// Start the server
const secureAI = new SecureCodeAI();
secureAI.start();

module.exports = SecureCodeAI;