require('dotenv').config();
const { body, validationResult } = require("express-validator");
const { initializeDatabase, queryDB, insertDB } = require("./database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const AesEncryption = require("aes-encryption");
const aes = new AesEncryption();
require('dotenv').config();
aes.setSecretKey(process.env.AES_SECRET);
const secretKey = process.env.SECRET_KEY;
let db;

// Middleware for token authentication with logging
async function authenticateToken(req, res, next) {
  try {
    req.log.info(`Authenticating token for ${req.method} ${req.originalUrl}`);
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      req.log.warn("Authorization header missing");
      return res.status(401).json({ message: "Unauthorized: Token missing" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      req.log.warn("Token not found in authorization header");
      return res.status(401).json({ message: "Unauthorized: Token missing" });
    }
    req.user = await new Promise((resolve, reject) => {
      jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
          req.log.error(`Token verification failed: ${err.message}`);
          reject(err);
        } else {
          resolve(decoded);
        }
      });
    });
    req.log.info(`Token authenticated for user: ${req.user.username}`);
    next();
  } catch (err) {
    req.log.error(`Authentication error: ${err.message}`);
    return res.status(403).json({ message: "Forbidden: invalid Token" });
  }
}

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    req.log.info(`Login attempt for user: ${username}`);
    // Query user by username
    const query = `SELECT * FROM users WHERE username = '${username}'`;
    const users = await queryDB(db, query);
    if (users.length !== 1) {
      req.log.warn(`Login failed for user ${username}: user not found`);
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const user = users[0];
    // Compare password with bcrypt
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      req.log.warn(`Login failed for user ${username}: invalid password`);
      return res.status(401).json({ error: "Invalid credentials" });
    }
    // Remove sensitive data
    delete user.password;
    // Create token payload
    const tokenPayload = {
      id: user.id,
      username: user.username
    };
    // Generate signed token (valid for 1 hour)
    const token = jwt.sign(tokenPayload, secretKey, { expiresIn: "1h" });
    req.log.info(`User ${username} logged in successfully`);
    res.json({ token, username: user.username, id: user.id });
  } catch (err) {
    req.log.error(`Login error for user ${req.body.username}: ${err.message}`);
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const register = async (req, res) => {
  try {
    const { username, password } = req.body;
    req.log.info(`Registration attempt for user: ${username}`);
    if (!username || !password) {
      req.log.warn("Registration failed: Missing username or password");
      return res.status(400).json({ error: "Username and password are required" });
    }
    // Check if user already exists
    const checkQuery = "SELECT * FROM users WHERE username = ?";
    const existingUsers = await queryDB(db, checkQuery, [username]);
    if (existingUsers.length > 0) {
      req.log.warn(`Registration failed: User ${username} already exists`);
      return res.status(400).json({ error: "User already exists" });
    }
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Insert user into the database
    const insertQuery = "INSERT INTO users (username, password) VALUES (?, ?)";
    await insertDB(db, insertQuery, [username, hashedPassword]);
    req.log.info(`User ${username} registered successfully`);
    res.json({ status: "registered" });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      req.log.warn(`Registration failed (constraint): User ${req.body.username} already exists`);
      return res.status(400).json({ error: "User already exists" });
    }
    req.log.error(`Registration error for user ${req.body.username}: ${error.message}`);
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getFeed = async (req, res) => {
  try {
    req.log.info(`Fetching feed for user: ${req.user.username}`);
    // Only load tweets of the authenticated user
    const query = "SELECT * FROM tweets WHERE username = ? ORDER BY id DESC";
    const tweets = await queryDB(db, query, [req.user.username]);
    // Decrypt the text of each tweet
    const decryptedTweets = tweets.map(tweet => ({
      ...tweet,
      text: tweet.text ? aes.decrypt(tweet.text) : null
    }));
    req.log.info(`Feed fetched successfully for user: ${req.user.username}`);
    res.json(decryptedTweets);
  } catch (err) {
    req.log.error(`Error fetching feed for user ${req.user.username}: ${err.message}`);
    console.error(err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
};

const postTweet = async (req, res) => {
  try {
    req.log.info(`User ${req.user.username} is posting a new tweet`);
    // req.body.text contains the plaintext tweet
    const { text } = req.body;
    if (!text || text.trim() === "") {
      req.log.warn("Tweet posting failed: Tweet text is required");
      return res.status(400).json({ error: "Tweet text is required" });
    }
    // Get username from token
    const username = req.user.username;
    const timestamp = new Date().toISOString();
    // Encrypt the tweet text
    const encryptedText = aes.encrypt(text);
    // Create the SQL query on the server side
    const query = "INSERT INTO tweets (username, timestamp, text) VALUES (?, ?, ?)";
    await insertDB(db, query, [username, timestamp, encryptedText]);
    req.log.info(`Tweet posted successfully by user ${username}`);
    res.json({ status: "ok" });
  } catch (err) {
    req.log.error(`Error posting tweet for user ${req.user.username}: ${err.message}`);
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const initializeAPI = async (app) => {
  // Initialize database
  db = await initializeDatabase();

  // GET-Feed: Route is protected by authenticateToken
  app.get("/api/feed", authenticateToken, async (req, res) => {
    await getFeed(req, res);
  });

  app.post(
      "/api/feed",
      authenticateToken,
      [
        body("text")
            .trim()
            .notEmpty()
            .withMessage("Text darf nicht leer sein")
      ],
      async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          req.log.warn("Tweet validation failed", { errors: errors.array() });
          return res.status(400).json({ errors: errors.array() });
        }
        await postTweet(req, res);
      }
  );

  app.post(
      "/api/register",
      [
        body("username")
            .isLength({ min: 6 })
            .withMessage("Username must be at least 6 characters long")
            .trim()
            .escape(),
        body("password")
            .isLength({ min: 6 })
            .withMessage("Password must be at least 6 characters long")
            .trim()
      ],
      async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          req.log.warn("Registration validation failed", { errors: errors.array() });
          return res.status(400).json({ errors: errors.array() });
        }
        await register(req, res);
      }
  );

  app.post(
      "/api/login",
      [
        body("username")
            .trim()
            .escape()
            .notEmpty()
            .withMessage("Username is required"),
        body("password")
            .trim()
            .escape()
            .notEmpty()
            .withMessage("Password is required")
      ],
      async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          req.log.warn("Login validation failed", { errors: errors.array() });
          return res.status(400).json({ errors: errors.array() });
        }
        await login(req, res);
      }
  );
};

module.exports = { initializeAPI };
