'use strict';
const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema(
  {
    nombre:             { type: String, required: [true, 'nombre es obligatorio'], trim: true },
    categoria:          { type: String, required: [true, 'categoria es obligatoria'], trim: true },
    cantidadDisponible: { type: Number, required: [true, 'cantidadDisponible es obligatoria'], min: [0, 'cantidadDisponible no puede ser negativa'] },
    unidadMedida:       { type: String, required: [true, 'unidadMedida es obligatoria'], trim: true },
    estado:             { type: String, required: [true, 'estado es obligatorio'], enum: ['disponible', 'agotado', 'en_cosecha'] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Producto', productoSchema);
