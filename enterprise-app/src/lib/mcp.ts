import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export async function discoverMcpTools(
  url: string,
  authType: string,
  authValue?: string | null
): Promise<McpTool[]> {
  const headers: Record<string, string> = {};
  if (authType === "bearer" && authValue) {
    headers["Authorization"] = `Bearer ${authValue}`;
  } else if (authType === "apikey" && authValue) {
    headers["X-API-Key"] = authValue;
  }

  const client = new Client({ name: "nexus-enterprise", version: "1.0.0" });

  try {
    const transport = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } });
    await client.connect(transport);
  } catch {
    const transport = new SSEClientTransport(new URL(url), { requestInit: { headers } });
    await client.connect(transport);
  }

  const { tools } = await client.listTools();
  await client.close();

  return tools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    inputSchema: t.inputSchema as Record<string, unknown>,
  }));
}

export async function callMcpTool(
  url: string,
  authType: string,
  authValue: string | null | undefined,
  toolName: string,
  toolArgs: Record<string, unknown>
): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (authType === "bearer" && authValue) {
    headers["Authorization"] = `Bearer ${authValue}`;
  } else if (authType === "apikey" && authValue) {
    headers["X-API-Key"] = authValue;
  }

  const client = new Client({ name: "nexus-enterprise", version: "1.0.0" });

  try {
    const transport = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } });
    await client.connect(transport);
  } catch {
    const transport = new SSEClientTransport(new URL(url), { requestInit: { headers } });
    await client.connect(transport);
  }

  const result = await client.callTool({ name: toolName, arguments: toolArgs });
  await client.close();
  return result;
}
