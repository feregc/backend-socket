const { Schema, model } = require('mongoose');

const AceptacionRechazoSchema = new Schema({
    solicitud: {
        type: Schema.Types.ObjectId,
        ref: 'SolicitudAmistad',
        required: true
    },
    usuario: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    accion: {
        type: String,
        enum: ['aceptada', 'rechazada'],
        required: true
    }
});

module.exports = model('AceptacionRechazo', AceptacionRechazoSchema);