const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');
const cors = require('cors');
const Usuario = require('../models/usuario');
const Sockets = require('./sockets');
const { dbConnection } = require('../database/config');

class Server {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3001;

        // Conectar a DB
        dbConnection();

        // Http server
        this.server = http.createServer(this.app);

        // Configuraciones de sockets
        this.io = socketio(this.server, {
            // Aquí puedes agregar opciones de configuración de Socket.IO si es necesario
        });
    }

    middlewares() {
        this.app.use(express.static(path.resolve(__dirname, '../public')));
        this.app.use(cors());
        this.app.use(express.json());

        // Agrega una ruta para la búsqueda de usuarios
        

        this.app.use('/api/login', require('../router/auth'));
        this.app.use('/api/mensajes', require('../router/mensajes'));

        this.app.get('/api/users/search', async (req, res) => {
            const { query } = req.query;
            try {
                const usuarios = await Usuario.find({ email: { $regex: query, $options: 'i' } });
                res.json(usuarios);
            } catch (error) {
                console.error('Error fetching search results:', error);
                res.status(500).json({ error: 'An error occurred' });
            }
        });
        
    }
    

    configurarSockets() {
        new Sockets(this.io);
    }

    execute() {
        this.middlewares();
        this.configurarSockets();

        this.server.listen(this.port, () => {
            console.log('Server corriendo en puerto:', this.port);
        });
    }
}

module.exports = Server;

