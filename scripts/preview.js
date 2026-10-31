const path = require('node:path');
const express = require('express');
const routes = require('../public/routes.json');
const app = express();
app.get('/index.html', (req, res) => res.redirect(308, '/' + req.originalUrl.slice(req.path.length)));
app.get(Object.keys(routes).filter(file => file !== 'index.html' && !file.startsWith('server/')).map(file => '/' + file), (req, res) => {
  res.redirect(308, routes[req.path.slice(1)] + req.originalUrl.slice(req.path.length));
});
app.use(express.static(path.resolve(__dirname, '../public')));
const port = Number(process.env.PREVIEW_PORT) || 4173;
app.listen(port, '127.0.0.1', () => console.log(`Frontend preview: http://127.0.0.1:${port}`));
