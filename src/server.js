'use strict';
const express = require('express');
const mongoose = require('mongoose');
const { conectarDB } = require('./config/database');
const productoRoutes = require('./routes/producto.routes');

const app = express();
app.use(express.json());

// Valores de mongoose.connection.readyState.
const ESTADOS_DB = ['desconectado', 'conectado', 'conectando', 'desconectando'];

app.get('/', (_req, res) => {
  res.json({
    servicio: 'Sistema de Gestión de Productos Agrícolas',
    endpoints: ['GET /health', 'GET /db-status', 'GET|POST /api/productos', 'GET|PUT|DELETE /api/productos/:id']
  });
});

// Salud del backend (no depende de MongoDB; se usa en los probes de Kubernetes).
app.get('/health', (_req, res) => res.status(200).json({ estado: 'ok' }));

// Estado real de la conexión con MongoDB (hace un ping autenticado).
app.get('/db-status', async (_req, res) => {
  const estado = ESTADOS_DB[mongoose.connection.readyState];
  try {
    await mongoose.connection.db.admin().ping();
    res.status(200).json({ mongodb: estado, ping: 'ok', host: process.env.DB_HOST, baseDeDatos: process.env.DB_NAME });
  } catch (err) {
    res.status(503).json({ mongodb: estado, ping: 'fallido', mensaje: err.message });
  }
});

app.use('/api/productos', productoRoutes);

app.use((_req, res) => res.status(404).json({ mensaje: 'Ruta no encontrada' }));

const PORT = parseInt(process.env.APP_PORT, 10) || 3000;

// El servidor HTTP arranca primero (el probe /health responde de inmediato);
// la conexión a MongoDB se reintenta en segundo plano.
app.listen(PORT, () => console.log(`[app] API escuchando en el puerto ${PORT}`));

conectarDB().catch((err) => {
  console.error(`[db] No se pudo conectar a MongoDB: ${err.message}`);
  process.exit(1); // Kubernetes reiniciará el Pod.
});
