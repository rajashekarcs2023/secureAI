// AWS Bedrock AgentCore MCP Connector for SecureCodeAI
// This handles the actual connection to your deployed Wiz MCP server

const AWS = require('aws-sdk');
const crypto = require('crypto');

class WizMCPConnector {
    constructor(config = {}) {
        this.agentRuntimeArn = config.agentRuntimeArn || process.env.WIZ_MCP_ENDPOINT;
        this.region = config.region || 'us-east-1';
        this.qualifier = config.qualifier || 'DEFAULT';
        
        // Initialize AWS Bedrock AgentCore client
        this.bedrockAgentCore = new AWS.BedrockAgentCore({
            region: this.region,
            apiVersion: '2023-07-26'
        });
        
        this.connectionStatus = 'disconnected';
        this.lastError = null;
        this.requestTimeout = config.timeout || 120000; // 2 minutes
    }

    /**
     * Test connection to the Wiz MCP server
     */
    async testConnection() {
        try {
            console.log('🔍 Testing Wiz MCP connection...');
            
            const result = await this.callMCPMethod('ping', {});
            
            if (result.success) {
                this.connectionStatus = 'connected';
                console.log('✅ Wiz MCP connection successful');
                return true;
            } else {
                throw new Error(result.error || 'Ping failed');
            }
        } catch (error) {
            this.connectionStatus = 'error';
            this.lastError = error.message;
            console.error('❌ Wiz MCP connection failed:', error.message);
            return false;
        }
    }

    /**
     * Call a method on the Wiz MCP server
     */
    async callMCPMethod(method, params = {}) {
        try {
            // Construct JSON-RPC 2.0 payload according to Wiz documentation
            const payload = {
                jsonrpc: "2.0",
                id: this.generateRequestId(),
                method: method,
                params: {
                    ...params,
                    _meta: {
                        progressToken: Date.now()
                    }
                }
            };

            console.log(`📤 Calling Wiz MCP method: ${method}`);
            
            const response = await this.invokeAgentRuntime(payload);
            
            if (response.success) {
                console.log(`✅ MCP method ${method} completed successfully`);
                return response.data;
            } else {
                throw new Error(response.error || `Method ${method} failed`);
            }
            
        } catch (error) {
            console.error(`❌ MCP method ${method} failed:`, error.message);
            throw error;
        }
    }

    /**
     * Get vulnerabilities from Wiz
     */
    async getVulnerabilities(filters = {}) {
        return await this.callMCPMethod('get_vulnerabilities', {
            filters: {
                severity: filters.severity || ['CRITICAL', 'HIGH', 'MEDIUM'],
                status: filters.status || ['OPEN'],
                limit: filters.limit || 100,
                ...filters
            }
        });
    }

    /**
     * Get security threats from Wiz
     */
    async getThreats(filters = {}) {
        return await this.callMCPMethod('get_threats', {
            filters: {
                riskScore: filters.riskScore || { min: 7.0 },
                limit: filters.limit || 50,
                ...filters
            }
        });
    }

    /**
     * Search for specific security patterns
     */
    async searchSecurityPatterns(query) {
        return await this.callMCPMethod('search_patterns', {
            query: query,
            includeRemediation: true,
            includeExamples: true
        });
    }

    /**
     * Get compliance status
     */
    async getComplianceStatus(framework = 'SOC2') {
        return await this.callMCPMethod('get_compliance_status', {
            framework: framework,
            includeControls: true
        });
    }

    /**
     * List available tools/methods on the MCP server
     */
    async listTools() {
        return await this.callMCPMethod('tools/list', {});
    }

    /**
     * Invoke the AWS Bedrock AgentCore runtime
     */
    async invokeAgentRuntime(payload) {
        try {
            // Convert payload to base64 as required by AWS API
            const payloadJson = JSON.stringify(payload);
            const payloadBase64 = Buffer.from(payloadJson).toString('base64');

            console.log(`🚀 Invoking agent runtime: ${this.agentRuntimeArn}`);
            console.log(`📦 Payload size: ${payloadJson.length} chars`);

            const params = {
                agentRuntimeArn: this.agentRuntimeArn,
                contentType: 'application/json',
                accept: 'application/json, text/event-stream',
                payload: payloadBase64,
                qualifier: this.qualifier
            };

            // Set timeout for the request
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), this.requestTimeout);
            });

            const invokePromise = this.bedrockAgentCore.invokeAgentRuntime(params).promise();

            const response = await Promise.race([invokePromise, timeoutPromise]);

            console.log('📥 Received response from agent runtime');

            // Handle the response
            return await this.parseAgentResponse(response);

        } catch (error) {
            console.error('❌ Agent runtime invocation failed:', error);
            
            // Handle specific AWS errors
            if (error.code === 'RuntimeClientError') {
                throw new Error(`Agent health check failed: ${error.message}`);
            } else if (error.code === 'AccessDeniedException') {
                throw new Error(`Access denied: Check IAM permissions for bedrock-agentcore:InvokeAgentRuntime`);
            } else if (error.code === 'ResourceNotFoundException') {
                throw new Error(`Agent not found: Check agent ARN and qualifier`);
            }
            
            throw error;
        }
    }

    /**
     * Parse the response from AWS Bedrock AgentCore
     */
    async parseAgentResponse(response) {
        try {
            let responseData = '';

            // Handle different response formats
            if (response.body) {
                if (typeof response.body === 'string') {
                    responseData = response.body;
                } else if (response.body.read) {
                    // It's a stream
                    const chunks = [];
                    response.body.on('data', chunk => chunks.push(chunk));
                    
                    await new Promise((resolve, reject) => {
                        response.body.on('end', resolve);
                        response.body.on('error', reject);
                    });
                    
                    responseData = Buffer.concat(chunks).toString();
                } else {
                    responseData = JSON.stringify(response.body);
                }
            } else {
                responseData = JSON.stringify(response);
            }

            console.log(`📄 Response data length: ${responseData.length}`);

            // Try to parse as JSON-RPC response
            try {
                const jsonResponse = JSON.parse(responseData);
                
                if (jsonResponse.error) {
                    return {
                        success: false,
                        error: jsonResponse.error.message || 'MCP method failed',
                        code: jsonResponse.error.code
                    };
                }

                return {
                    success: true,
                    data: jsonResponse.result || jsonResponse,
                    id: jsonResponse.id
                };
                
            } catch (parseError) {
                // Response might not be JSON, return as-is
                console.warn('⚠️ Response is not valid JSON, returning raw data');
                return {
                    success: true,
                    data: responseData,
                    raw: true
                };
            }

        } catch (error) {
            console.error('❌ Failed to parse agent response:', error);
            return {
                success: false,
                error: `Failed to parse response: ${error.message}`
            };
        }
    }

    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return crypto.randomBytes(8).toString('hex');
    }

    /**
     * Get connection status and health
     */
    getStatus() {
        return {
            status: this.connectionStatus,
            agentArn: this.agentRuntimeArn,
            region: this.region,
            qualifier: this.qualifier,
            lastError: this.lastError,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Refresh connection (useful if agent was redeployed)
     */
    async refreshConnection() {
        console.log('🔄 Refreshing Wiz MCP connection...');
        this.connectionStatus = 'disconnected';
        this.lastError = null;
        
        return await this.testConnection();
    }
}

// Example usage and testing
class WizMCPTester {
    constructor(connector) {
        this.connector = connector;
    }

    async runTests() {
        console.log('🧪 Running Wiz MCP integration tests...\n');

        const tests = [
            { name: 'Connection Test', method: () => this.connector.testConnection() },
            { name: 'List Tools', method: () => this.testListTools() },
            { name: 'Get Vulnerabilities', method: () => this.testGetVulnerabilities() },
            { name: 'Get Threats', method: () => this.testGetThreats() },
            { name: 'Search Patterns', method: () => this.testSearchPatterns() }
        ];

        const results = [];

        for (const test of tests) {
            try {
                console.log(`🔍 Running: ${test.name}`);
                const startTime = Date.now();
                
                const result = await test.method();
                const duration = Date.now() - startTime;
                
                console.log(`✅ ${test.name} passed (${duration}ms)\n`);
                results.push({ name: test.name, status: 'passed', duration, result });
                
            } catch (error) {
                console.error(`❌ ${test.name} failed: ${error.message}\n`);
                results.push({ name: test.name, status: 'failed', error: error.message });
            }
        }

        return results;
    }

    async testListTools() {
        const tools = await this.connector.listTools();
        console.log(`📋 Available tools: ${JSON.stringify(tools, null, 2)}`);
        return tools;
    }

    async testGetVulnerabilities() {
        const vulns = await this.connector.getVulnerabilities({ limit: 5 });
        console.log(`🔒 Found ${vulns?.vulnerabilities?.length || 0} vulnerabilities`);
        return vulns;
    }

    async testGetThreats() {
        const threats = await this.connector.getThreats({ limit: 5 });
        console.log(`⚠️ Found ${threats?.threats?.length || 0} threats`);
        return threats;
    }

    async testSearchPatterns() {
        const patterns = await this.connector.searchSecurityPatterns('s3 bucket public');
        console.log(`🔍 Found ${patterns?.patterns?.length || 0} security patterns`);
        return patterns;
    }
}

// Export for use in SecureCodeAI backend
module.exports = { WizMCPConnector, WizMCPTester };

// CLI testing if run directly
if (require.main === module) {
    async function main() {
        console.log('🛡️ SecureCodeAI - Wiz MCP Connector Test\n');

        // Initialize connector with environment variables
        const connector = new WizMCPConnector({
            agentRuntimeArn: process.env.WIZ_MCP_ENDPOINT,
            region: process.env.AWS_REGION || 'us-east-1',
            qualifier: process.env.WIZ_MCP_QUALIFIER || 'DEFAULT'
        });

        // Run tests
        const tester = new WizMCPTester(connector);
        const results = await tester.runTests();

        // Summary
        console.log('📊 Test Summary:');
        const passed = results.filter(r => r.status === 'passed').length;
        const failed = results.filter(r => r.status === 'failed').length;
        
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);

        if (failed === 0) {
            console.log('\n🎉 All tests passed! Wiz MCP integration is working correctly.');
        } else {
            console.log('\n💡 Some tests failed. Check your configuration:');
            console.log('   - WIZ_MCP_ENDPOINT is set correctly');
            console.log('   - Wiz MCP agent has WIZ_CLIENT_ID and WIZ_CLIENT_SECRET');
            console.log('   - AWS credentials have proper permissions');
            console.log('   - Agent is deployed and healthy');
        }

        process.exit(failed === 0 ? 0 : 1);
    }

    main().catch(console.error);
}