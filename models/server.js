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
      const { userEmail, friendEmail } = req.body;

      try {
        const usuario = await Usuario.findOne({ email: userEmail });
        const amigo = await Usuario.findOne({ email: friendEmail });

        if (!usuario || !amigo) {
          return res
            .status(404)
            .json({ error: "Usuario o amigo no encontrado" });
        }

        // Encontrar la solicitud pendiente correspondiente y actualizar su estado
        const solicitudPendiente = await SolicitudAmistad.findOneAndUpdate(
          { remitente: amigo._id, receptor: usuario._id, estado: "pendiente" },
          { estado: "aceptada" }
        );

        if (!solicitudPendiente) {
          return res
            .status(404)
            .json({ error: "Solicitud pendiente no encontrada" });
        }

        // Actualizar los campos de amigos en ambos usuarios
        usuario.amigos.push(amigo._id);
        amigo.amigos.push(usuario._id);

        await usuario.save();
        await amigo.save();

        res.json({ message: "Solicitud de amistad aceptada" });
      } catch (error) {
        console.error("Error al aceptar solicitud de amistad:", error);
        res.status(500).json({ error: "Ha ocurrido un error" });
      }
    });

    // Endpoint para rechazar una solicitud de amistad
    this.app.post("/api/users/reject-friend-request", async (req, res) => {
      const { userEmail, friendEmail } = req.body;

      try {
        const usuario = await Usuario.findOne({ email: userEmail });
        const amigo = await Usuario.findOne({ email: friendEmail });

        if (!usuario || !amigo) {
          return res
            .status(404)
            .json({ error: "Usuario o amigo no encontrado" });
        }

        // Encontrar y eliminar la solicitud pendiente
        await SolicitudAmistad.findOneAndDelete({
          remitente: amigo._id,
          receptor: usuario._id,
          estado: "pendiente",
        });

        res.json({ message: "Solicitud de amistad rechazada" });
      } catch (error) {
        console.error("Error al rechazar solicitud de amistad:", error);
        res.status(500).json({ error: "Ha ocurrido un error" });
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
