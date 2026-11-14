'use strict';
const mongoose = require('mongoose');
const Producto = require('../models/producto.model');

const idValido = (id) => mongoose.Types.ObjectId.isValid(id);

// Convierte errores de validación de Mongoose en respuestas 400.
function manejarError(res, err) {
  if (err.name === 'ValidationError') {
    return res.status(400).json({ mensaje: 'Datos inválidos', errores: Object.values(err.errors).map((e) => e.message) });
  }
  console.error(err);
  return res.status(500).json({ mensaje: 'Error interno del servidor' });
}

exports.crear = async (req, res) => {
  try {
    const producto = await Producto.create(req.body);
    res.status(201).json(producto);
  } catch (err) { manejarError(res, err); }
};

exports.listar = async (_req, res) => {
  try {
    res.status(200).json(await Producto.find().sort({ createdAt: 1 }));
  } catch (err) { manejarError(res, err); }
};

exports.obtener = async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ mensaje: 'Identificador inválido' });
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });
    res.status(200).json(producto);
  } catch (err) { manejarError(res, err); }
};

exports.actualizar = async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ mensaje: 'Identificador inválido' });
    const producto = await Producto.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });
    res.status(200).json(producto);
  } catch (err) { manejarError(res, err); }
};

exports.eliminar = async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ mensaje: 'Identificador inválido' });
    const producto = await Producto.findByIdAndDelete(req.params.id);
    if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });
    res.status(200).json({ mensaje: 'Producto eliminado', producto });
  } catch (err) { manejarError(res, err); }
};
