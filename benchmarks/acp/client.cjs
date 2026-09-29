'use strict';

const { spawn } = require('node:child_process');
const { createWriteStream } = require('node:fs');
const readline = require('node:readline');

// Cursor ACP uses one JSON-RPC object per line on stdio.
class AcpClient {
  constructor({ command, args, cwd, env, transcript, stderr, onRequest, onUpdate, authenticate = true }) {
    this.process = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    this.transcript = createWriteStream(transcript);
    this.errorLog = createWriteStream(stderr);
    this.process.stderr.pipe(this.errorLog);
    this.pending = new Map();
    this.nextId = 1;
    this.onRequest = onRequest;
    this.onUpdate = onUpdate;
    this.authenticate = authenticate;
    this.closed = new Promise((resolve) => {
      this.process.on('close', (code, signal) => {
        for (const waiter of this.pending.values()) waiter.reject(new Error(`ACP exited: ${code ?? signal}`));
        this.pending.clear();
        resolve({ code, signal });
      });
    });
    this.process.on('error', (error) => {
      for (const waiter of this.pending.values()) waiter.reject(error);
      this.pending.clear();
    });
    readline.createInterface({ input: this.process.stdout }).on('line', (line) => this.receive(line));
  }

  write(message) {
    const line = `${JSON.stringify(message)}\n`;
    this.transcript.write(JSON.stringify({ direction: 'client', at: new Date().toISOString(), message }) + '\n');
    this.process.stdin.write(line);
  }

  request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.write({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify(method, params) {
    this.write({ jsonrpc: '2.0', method, params });
  }

  receive(line) {
    let message;
    try { message = JSON.parse(line); } catch {
      this.transcript.write(JSON.stringify({
        direction: 'agent', at: new Date().toISOString(), malformed: line,
      }) + '\n');
      return;
    }
    this.transcript.write(JSON.stringify({ direction: 'agent', at: new Date().toISOString(), message }) + '\n');
    if (Object.hasOwn(message, 'id') && !message.method) {
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
      else waiter.resolve(message.result);
    } else if (message.method === 'session/update') {
      this.onUpdate?.(message.params);
    } else if (Object.hasOwn(message, 'id') && message.method) {
      Promise.resolve().then(() => this.onRequest(message.method, message.params)).then(
        (result) => this.write({ jsonrpc: '2.0', id: message.id, result }),
        (error) => this.write({ jsonrpc: '2.0', id: message.id, error: { code: -32000, message: error.message } }),
      );
    }
  }

  async initialize() {
    await this.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: { name: 'bouncer-benchmark', version: '1.0.0' },
    });
    // API-key deployments are preauthenticated; Cursor's cursor_login method opens a browser.
    if (this.authenticate) await this.request('authenticate', { methodId: 'cursor_login' });
  }

  async newSession(cwd = '/workspace') {
    const result = await this.request('session/new', { cwd, mcpServers: [] });
    if (!result?.sessionId) throw new Error('ACP session/new returned no sessionId');
    return result.sessionId;
  }

  prompt(sessionId, text) {
    return this.request('session/prompt', { sessionId, prompt: [{ type: 'text', text }] });
  }

  async stop() {
    this.process.stdin.end();
    this.process.kill('SIGTERM');
    await this.closed;
    await Promise.all([new Promise((r) => this.transcript.end(r)), new Promise((r) => this.errorLog.end(r))]);
  }
}

module.exports = { AcpClient };
