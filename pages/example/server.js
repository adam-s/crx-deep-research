import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Main route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Additional routes for iframe content
app.get('/iframe1', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'iframe1.html'));
});

app.get('/iframe2', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'iframe2.html'));
});

app.get('/nested-iframe', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'nested-iframe.html'));
});

// Error handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res) => {
  console.error('Server error:', err);
  res.status(500).send('Internal Server Error');
});

// 404 handler
app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.listen(PORT, () => {
  console.log(`🚀 Cordyceps Example Server running at http://localhost:${PORT}`);
  console.log(`📍 Main page: http://localhost:${PORT}`);
  console.log(`📍 Iframe 1: http://localhost:${PORT}/iframe1`);
  console.log(`📍 Iframe 2: http://localhost:${PORT}/iframe2`);
  console.log(`📍 Nested iframe: http://localhost:${PORT}/nested-iframe`);
});
