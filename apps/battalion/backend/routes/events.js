const express = require('express');
const router = express.Router();
const { addClient } = require('../utils/events');

router.get('/stream', (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://jeffersonwm.com',
    'https://www.jeffersonwm.com'
  ]);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    ...(origin && allowedOrigins.has(origin)
      ? { 'Access-Control-Allow-Origin': origin }
      : {})
  });

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write('data: {"type":"connected"}\n\n');

  const heartbeatId = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  res.on('close', () => {
    clearInterval(heartbeatId);
  });

  addClient(res);
});

module.exports = router;
