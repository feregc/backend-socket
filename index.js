// Server Model: Contiene todo el servidor de express + socket.io configurado
const Server = require('./models/server');

// Paquete para leer y establecer las variables de entorno
require('dotenv').config();


// Inicializar la instancia del server
const server = new Server();
const httpServer = server.server; // Obtener el objeto del servidor HTTP
// Ejecutar el server
server.execute();


