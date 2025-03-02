const { body, validationResult } = require("express-validator");
const { initializeDatabase, queryDB, insertDB } = require("./database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const secretKey = process.env.SECRET_KEY || "your_secret_key";
let db;

// Middleware zur Token-Authentifizierung
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ message: "Unauthorized: Token fehlt" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized: Token fehlt" });
    }
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, secretKey, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Forbidden: Ungültiges Token" });
  }
}

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    // Benutzer anhand des Benutzernamens abfragen
    const query = `SELECT * FROM users WHERE username = '${username}'`;
    const users = await queryDB(db, query);
    if (users.length !== 1) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const user = users[0];
    // Passwortvergleich mittels bcrypt
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    // Entfernt sensible Daten
    delete user.password;

    // Erstellt das Token-Payload
    const tokenPayload = {
      id: user.id,
      username: user.username
    };

    // Generiert ein signiertes Token (gültig für 1 Stunde)
    const token = jwt.sign(tokenPayload, secretKey, { expiresIn: "1h" });
    res.json({ token, username: user.username, id: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getFeed = async (req, res) => {
  try {
    // Fester Query, der ausschließlich auf der Serverseite definiert ist
    const query = "SELECT * FROM tweets ORDER BY id DESC";
    const tweets = await queryDB(db, query);
    res.json(tweets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
};


const postTweet = async (req, res) => {
  try {
    const { text } = req.body;
    // Hier erstellt der Server die SQL-Query auf Basis der übermittelten Daten:
    const username = req.user.username;
    const timestamp = new Date().toISOString();
    const query = `INSERT INTO tweets (username, timestamp, text) VALUES (?, ?, ?)`;
    // Nutze z. B. Prepared Statements oder entsprechende Funktionen, um SQL-Injection zu verhindern
    await insertDB(db, query, [username, timestamp, text]);
    res.json({ status: "ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
};

const initializeAPI = async (app) => {
  // Datenbank initialisieren
  db = await initializeDatabase();

  // GET-Feed: Route wird durch authenticateToken geschützt
  app.get("/api/feed", authenticateToken, async (req, res) => {
    await getFeed(req, res);
  });

  app.post(
      "/api/feed",
      [body("query").trim().notEmpty().withMessage("Query darf nicht leer sein")],
      async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        await postTweet(req, res);
      }
  );

  app.post(
      "/api/login",
      [
        body("username").trim().escape().notEmpty().withMessage("Username darf nicht leer sein"),
        body("password").trim().escape().notEmpty().withMessage("Password darf nicht leer sein")
      ],
      async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        await login(req, res);
      }
  );
};

module.exports = { initializeAPI };
