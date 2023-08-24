const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const path = require("path");
const cors = require("cors");
const Usuario = require("../models/usuario");
const Sockets = require("./sockets");
const { dbConnection } = require("../database/config");
const SolicitudAmistad = require("../models/solicitudes"); // Asegúrate de que la ruta sea correcta
const io = require("socket.io")(this.server); // Donde `httpServer` es tu servidor HTTP

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
    this.app.use(express.static(path.resolve(__dirname, "../public")));
    this.app.use(cors());
    this.app.use(express.json());

    // Agrega una ruta para la búsqueda de usuarios

    this.app.use("/api/login", require("../router/auth"));
    this.app.use("/api/mensajes", require("../router/mensajes"));

    this.app.get("/api/users/search", async (req, res) => {
      const { query } = req.query;
      try {
        const usuarios = await Usuario.find({
          email: { $regex: query, $options: "i" },
        });
        res.json(usuarios);
      } catch (error) {
        console.error("Error fetching search results:", error);
        res.status(500).json({ error: "An error occurred" });
      }
    });

    this.app.post("/api/users/send-friend-request", async (req, res) => {
      const { userEmail, friendEmail } = req.body;

    //   console.log("userEmail:", userEmail);
    //   console.log("friendEmail:", friendEmail);

      try {
        const usuarioBuscado = await Usuario.findOne({ email: userEmail });
        const amigo = await Usuario.findOne({ email: friendEmail });

        if (!usuarioBuscado || !amigo) {
          return res
            .status(404)
            .json({ error: "Usuario o amigo no encontrado" });
        }

        if (usuarioBuscado.email !== userEmail) {
          return res
            .status(400)
            .json({ error: "El email no coincide con el usuario buscado" });
        }

        const solicitudExistente = await SolicitudAmistad.findOne({
          remitente: usuarioBuscado._id,
          receptor: amigo._id,
          estado: "pendiente",
        });

        if (solicitudExistente) {
          return res
            .status(400)
            .json({ error: "Ya existe una solicitud pendiente" });
        }

        const nuevaSolicitud = new SolicitudAmistad({
          remitente: usuarioBuscado._id,
          receptor: amigo._id,
          estado: "pendiente",
        });

        await nuevaSolicitud.save();

        io.to(amigo.socketId).emit("friendRequest", {
          from: usuarioBuscado._id,
          message: `¡${usuarioBuscado.nombre} te ha enviado una solicitud de amistad!`,
        });

        res.json({ message: "Solicitud de amistad enviada" });
      } catch (error) {
        console.error("Error al enviar solicitud de amistad:", error);
        res.status(500).json({ error: "Ha ocurrido un error" });
      }
    });

// Endpoint para aceptar una solicitud de amistad
this.app.post("/api/users/accept-friend-request", async (req, res) => {
  const { solicitudId } = req.body; // Cambio aquí

  try {
    const solicitud = await SolicitudAmistad.findById(solicitudId)
      .populate('remitente receptor') // Asegúrate de que los campos de remitente y receptor estén poblados correctamente
      .exec();

    if (!solicitud || solicitud.estado !== 'pendiente') {
      return res.status(404).json({ error: 'Solicitud no encontrada o no está pendiente' });
    }

    solicitud.estado = 'aceptada';
    await solicitud.save();

    // Actualizar los campos de amigos en ambos usuarios
    solicitud.remitente.amigos.push(solicitud.receptor);
    solicitud.receptor.amigos.push(solicitud.remitente);

    await solicitud.remitente.save();
    await solicitud.receptor.save();

    res.json({ message: 'Solicitud de amistad aceptada' });
  } catch (error) {
    console.error('Error al aceptar solicitud de amistad:', error);
    res.status(500).json({ error: 'Ha ocurrido un error' });
  }
});

// Endpoint para rechazar una solicitud de amistad
this.app.post("/api/users/reject-friend-request", async (req, res) => {
    const { solicitudId } = req.body; // Cambio aquí

    try {
      const solicitud = await SolicitudAmistad.findById(solicitudId)
        .populate('remitente receptor') // Asegúrate de que los campos de remitente y receptor estén poblados correctamente
        .exec();
  
      if (!solicitud || solicitud.estado !== 'pendiente') {
        return res.status(404).json({ error: 'Solicitud no encontrada o no está pendiente' });
      }
  
      solicitud.estado = 'rechazada';
      await solicitud.save();

  
      res.json({ message: 'Solicitud de amistad rechazado' });
    } catch (error) {
      console.error('Error al rechazar solicitud de amistad:', error);
      res.status(500).json({ error: 'Ha ocurrido un error' });
    }
});


    this.app.get('/api/users/friend-requests-received', async (req, res) => {
      const { userEmail } = req.query;
  
      try {
          const usuario = await Usuario.findOne({ email: userEmail });
  
          if (!usuario) {
              return res.status(404).json({ error: 'Usuario no encontrado' });
          }
  
          const solicitudesRecibidas = await SolicitudAmistad.find({ receptor: usuario._id, estado: 'pendiente' })
              .populate('remitente', 'nombre')
              .exec();
  
          res.json(solicitudesRecibidas);
      } catch (error) {
          console.error('Error fetching friend requests:', error);
          res.status(500).json({ error: 'Ha ocurrido un error' });
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
      console.log("Server corriendo en puerto:", this.port);
    });
  }
}

module.exports = Server;
