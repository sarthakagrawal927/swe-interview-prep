import { spawn } from 'child_process';

const CLI_TOOLS = {
  claude: {
    command: 'claude',
    buildArgs: (model, systemPrompt) => {
      const args = ['-p', '--output-format', 'stream-json', '--verbose'];
      if (model) args.push('--model', model);
      if (systemPrompt) args.push('--system-prompt', systemPrompt);
      return args;
    },
    inputMode: 'stdin',
    embedSystemPrompt: false,
    parseStream: (line, emit) => {
      const json = JSON.parse(line);
      if (json.type === 'assistant' && json.message?.content) {
        for (const block of json.message.content) {
          if (block.type === 'text' && block.text) emit(block.text);
        }
        return;
      }
      if (json.type === 'content_block_delta' && json.delta?.text) {
        emit(json.delta.text);
      }
    },
  },
  codex: {
    command: 'codex',
    buildArgs: (model) => {
      const args = ['exec', '--json'];
      if (model) args.push('--model', model);
      return args;
    },
    inputMode: 'stdin',
    embedSystemPrompt: true,
    parseStream: (line, emit) => {
      const json = JSON.parse(line);
      if (json.type === 'item.completed' && json.item?.type === 'agent_message' && json.item.text) {
        emit(json.item.text);
      }
    },
  },
  gemini: {
    command: 'gemini',
    buildArgs: (model) => {
      const args = [];
      if (model) args.push('--model', model);
      return args;
    },
    inputMode: 'arg',
    embedSystemPrompt: true,
    parseStream: null,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, tool, model, messages, systemPrompt } = req.body;
  const providerName = provider || tool || 'claude';

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const cliTool = CLI_TOOLS[providerName];
  if (!cliTool) {
    return res.status(400).json({
      error: `Unknown provider: ${providerName}`,
      available: Object.keys(CLI_TOOLS),
    });
  }

  let prompt = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  if (cliTool.embedSystemPrompt && systemPrompt) {
    prompt = `System instructions: ${systemPrompt}\n\n${prompt}`;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const args = cliTool.buildArgs(model, systemPrompt);
  if (cliTool.inputMode === 'arg') args.push('-p', prompt);

  const proc = spawn(cliTool.command, args, {
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (cliTool.inputMode === 'stdin') {
    proc.stdin.write(prompt);
    proc.stdin.end();
  }

  let buffer = '';
  let textSent = false;
  const isPlainText = !cliTool.parseStream;

  proc.stdout.on('data', (data) => {
    if (isPlainText) {
      const text = data.toString();
      if (text) {
        textSent = true;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
      return;
    }

    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        cliTool.parseStream(line, (text) => {
          textSent = true;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        });
      } catch {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
          textSent = true;
          res.write(`data: ${JSON.stringify({ text: trimmed + '\n' })}\n\n`);
        }
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.error(`[${providerName} stderr]`, msg);
  });

  proc.on('close', (code) => {
    if (buffer.trim()) {
      if (isPlainText) {
        res.write(`data: ${JSON.stringify({ text: buffer.trim() })}\n\n`);
      } else {
        try {
          cliTool.parseStream(buffer, (text) => {
            textSent = true;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          });
        } catch {
          if (!textSent) {
            res.write(`data: ${JSON.stringify({ text: buffer.trim() })}\n\n`);
          }
        }
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
    if (code !== 0) console.error(`[${providerName}] exited with code ${code}`);
  });

  proc.on('error', (err) => {
    console.error(`[${providerName} spawn error]`, err.message);
    res.write(`data: ${JSON.stringify({ error: `Failed to start ${providerName} CLI. Is it installed?` })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });

  req.on('close', () => {
    if (!proc.killed) proc.kill('SIGTERM');
  });
}
