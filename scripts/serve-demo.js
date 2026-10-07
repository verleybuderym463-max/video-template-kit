import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, sep } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.VIDEO_TEMPLATE_DEMO_PORT || 4178);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error('VIDEO_TEMPLATE_DEMO_PORT must be an integer between 1024 and 65535.');
  process.exit(1);
}

const server = createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const asset = pathname === '/' ? '/demo/index.html' : pathname;
    if (!asset.startsWith('/demo/') && !asset.startsWith('/src/')) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const path = resolve(root, `.${asset}`);
    if (![resolve(root, 'demo'), resolve(root, 'src')].some((directory) => path.startsWith(`${directory}${sep}`))) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const data = await readFile(path);
    const type = path.endsWith('.html') ? 'text/html' : path.endsWith('.js') ? 'text/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use; set VIDEO_TEMPLATE_DEMO_PORT to another port.` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`Video Template Kit demo: http://127.0.0.1:${port}`));
