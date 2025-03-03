const express = require("express");
const http = require("http");
const { initializeAPI } = require("./api");
const rateLimit = require("express-rate-limit"); // Neuer Import
require('dotenv').config();


// Create the express server
const app = express();
app.use(express.json());
const server = http.createServer(app);

app.disable('x-powered-by');

// Rate limiter für den Login-Endpoint
const loginLimiter = rateLimit({
  windowMs: 60 * 1000 , // 10 Minute
  max: 50, // Maximal 10 Anfragen alle 10 minuten
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
