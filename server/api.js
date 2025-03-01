const { body, validationResult } = require("express-validator");
const { initializeDatabase, queryDB, insertDB } = require("./database");

let db;

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
    const user = await queryDB(db, query);
    if (user.length === 1) {
      res.json(user[0]);
    } else {
      res.json({ error: "Ungültige Anmeldedaten" });
    }
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
