const { body, validationResult } = require("express-validator");
const { initializeDatabase, queryDB, insertDB } = require("./database");
const bcrypt = require("bcrypt");

let db;

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    // Holt Benutzer anhand des Benutzernamens
    const query = `SELECT * FROM users WHERE username = '${username}'`;
    const users = await queryDB(db, query);
    if (users.length !== 1) {
      return res.json({ error: "Ungültige Anmeldedaten" });
    }
    const user = users[0];
    // Vergleicht das eingegebene Passwort mit dem gehashten Passwort in der DB
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.json({ error: "Ungültige Anmeldedaten" });
    }
    // Entfernt das Passwort, bevor du den Benutzer zurückgibst
    delete user.password;
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
};

const getFeed = async (req, res) => {
  try {
    const query = req.query.q;
    const tweets = await queryDB(db, query);
    res.json(tweets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
};

const postTweet = async (req, res) => {
  try {
    await insertDB(db, req.body.query);
    res.json({ status: "ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
};

const initializeAPI = async (app) => {
  // Datenbank initialisieren
  db = await initializeDatabase();

  app.get("/api/feed", async (req, res) => {
    await getFeed(req, res);
  });

  app.post(
      "/api/feed",
      [
        body("query")
            .trim()
            .notEmpty()
            .withMessage("Query darf nicht leer sein")
      ],
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
        body("username")
            .trim()
            .escape()
            .notEmpty()
            .withMessage("Username darf nicht leer sein"),
        body("password")
            .trim()
            .escape()
            .notEmpty()
            .withMessage("Password darf nicht leer sein")
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
