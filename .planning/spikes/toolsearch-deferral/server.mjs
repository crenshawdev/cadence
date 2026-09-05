#!/usr/bin/env node
// Minimal MCP stdio server for the deferral probe. Two tools, no domain logic.
//   probe_alpha - the tool the probe loads and calls
//   probe_bravo - the paired control the probe never loads
// Every call is logged to CALLS_LOG so the server's own view of what happened
// is readable independently of the client transcript.
import { appendFileSync } from 'node:fs';

const LOG = process.env.PROBE_CALLS_LOG;
const log = (o) => { if (LOG) appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), ...o }) + '\n'); };

const TOOLS = [
  {
    name: 'probe_alpha',
    description: 'Probe tool ALPHA. Returns the text it was given, prefixed. Used as the loaded arm of a tool-deferral probe.',
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'Any string.' } }, required: ['text'] },
  },
  {
    name: 'probe_bravo',
    description: 'Probe tool BRAVO. Returns the text it was given, prefixed. Used as the never-loaded control arm of a tool-deferral probe.',
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'Any string.' } }, required: ['text'] },
  },
];

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (line) handle(line);
  }
});

function send(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }

function handle(line) {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  log({ event: 'rpc', method, id: id ?? null });

  if (method === 'initialize') {
    return send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'probe', version: '0.0.1' },
      },
    });
  }
  if (method === 'notifications/initialized') return;
  if (method === 'tools/list') {
    log({ event: 'tools_list_served', names: TOOLS.map((t) => t.name) });
    return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  }
  if (method === 'tools/call') {
    const name = params?.name;
    const text = params?.arguments?.text ?? '';
    log({ event: 'tool_called', name, text });
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) {
      return send({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: `no such tool: ${name}` }] } });
    }
    return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `${name.toUpperCase()} received: ${text}` }] } });
  }
  if (id !== undefined && id !== null) {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
  }
}
