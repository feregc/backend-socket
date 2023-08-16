const { Schema, model } = require('mongoose');

const SolicitudAmistadSchema = new Schema({
    remitente: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    receptor: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    estado: {
        type: String,
        enum: ['pendiente', 'aceptada', 'rechazada'],
        default: 'pendiente'
    }
});

module.exports = model('SolicitudAmistad', SolicitudAmistadSchema);
