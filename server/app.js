const express = require("express");
const http = require("http");
const { initializeAPI } = require("./api");
const rateLimit = require("express-rate-limit"); // Neuer Import
require('dotenv').config();
const pino = require('pino-http')()


// Create the express server
const app = express();
app.use(express.json());
const server = http.createServer(app);

// Pino-HTTP Middleware einbinden
app.use(pino);

app.disable('x-powered-by');

// Rate limiter
const loginLimiter = rateLimit({
  windowMs: 60 * 1000 ,
  max: 50,
  message: "Zu viele Anfragen, bitte versuchen Sie es in einer Minute erneut."
});
app.use("/api/login", loginLimiter);

// deliver static files from the client folder like css, js, images
app.use(express.static("client"));
// route for the homepage
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/client/index.html");
});

// Initialize the REST api
initializeAPI(app);

//start the web server
const serverPort = process.env.PORT || 3001;
server.listen(serverPort, () => {
  console.log(`Express Server started on port ${serverPort}`);
});
