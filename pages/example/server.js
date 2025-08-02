import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT ?? 3005;
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();

// Serve everything in /public as static assets
app.use(express.static(PUBLIC_DIR));

// Define all HTML routes in one place
const pages = [
  { route: '/', file: 'index.html', label: 'Main page' },
  { route: '/iframe1', file: 'iframe1.html', label: 'Iframe 1' },
  { route: '/iframe2', file: 'iframe2.html', label: 'Iframe 2' },
  { route: '/nested-iframe', file: 'nested-iframe.html', label: 'Nested iframe' },
];

pages.forEach(({ route, file }) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, file));
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).send('404: Page Not Found');
});

// Error handler
app.use((err, req, res) => {
  console.error('Server error:', err);
  res.status(500).send('500: Internal Server Error');
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening at http://localhost:${PORT}`);
  pages.forEach(({ route, label }) => {
    console.log(`📍 ${label}: http://localhost:${PORT}${route}`);
  });
});
