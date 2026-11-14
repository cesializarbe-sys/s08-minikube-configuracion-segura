'use strict';
const mongoose = require('mongoose');
const Producto = require('../models/producto.model');

// Datos de prueba (solo se cargan si la colección está vacía).
const PRODUCTOS_INICIALES = [
  { nombre: 'Mandarina',  categoria: 'Cítricos', cantidadDisponible: 1200, unidadMedida: 'kg', estado: 'disponible' },
  { nombre: 'Palta Hass', categoria: 'Frutas',   cantidadDisponible: 800,  unidadMedida: 'kg', estado: 'disponible' },
  { nombre: 'Arándano',   categoria: 'Berries',  cantidadDisponible: 450,  unidadMedida: 'kg', estado: 'disponible' },
  { nombre: 'Caqui',      categoria: 'Frutas',   cantidadDisponible: 0,    unidadMedida: 'kg', estado: 'agotado' }
];

/**
 * Construye la URI a partir de variables de entorno inyectadas por Kubernetes:
 *   ConfigMap -> DB_HOST, DB_NAME      Secret -> DB_USER, DB_PASS
 * Usuario y contraseña se codifican para soportar caracteres especiales.
 * authSource=admin porque el usuario root de MongoDB se crea en la BD "admin".
 */
function buildMongoUri() {
  const { DB_HOST, DB_NAME, DB_USER, DB_PASS } = process.env;
  const faltantes = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS'].filter((v) => !process.env[v]);
  if (faltantes.length) {
    throw new Error(`Faltan variables de entorno: ${faltantes.join(', ')}`);
  }
  const port = process.env.DB_PORT || '27017';
  return `mongodb://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASS)}@${DB_HOST}:${port}/${DB_NAME}?authSource=admin`;
}

async function sembrarDatos() {
  if ((await Producto.estimatedDocumentCount()) === 0) {
    await Producto.insertMany(PRODUCTOS_INICIALES);
    console.log(`[db] ${PRODUCTOS_INICIALES.length} productos de prueba insertados en MongoDB`);
  }
}

/** Conecta con reintentos: MongoDB puede tardar unos segundos en estar listo. */
async function conectarDB(intentos = 30, esperaMs = 3000) {
  const uri = buildMongoUri();
  for (let i = 1; i <= intentos; i++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log(`[db] Conectado a MongoDB (host=${process.env.DB_HOST}, db=${process.env.DB_NAME})`);
      await sembrarDatos();
      return;
    } catch (err) {
      // Nunca se imprime la URI: contiene credenciales.
      console.error(`[db] Intento ${i}/${intentos} fallido: ${err.message}`);
      if (i === intentos) throw err;
      await new Promise((r) => setTimeout(r, esperaMs));
    }
  }
}

module.exports = { conectarDB };
