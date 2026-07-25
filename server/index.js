const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const app = express();
const port = 4000;
const SECRET = 'replace-this-secret';
const AGORA_APP_ID = process.env.AGORA_APP_ID || '59b7fe9ce33b40d3a8b3aa560f1fc179';
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '***REMOVED***';

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, password TEXT, userCode TEXT UNIQUE)');
  db.run('CREATE TABLE friends (id INTEGER PRIMARY KEY, userId INTEGER, friendId INTEGER)');
  db.run('CREATE TABLE groups (id INTEGER PRIMARY KEY, name TEXT, ownerId INTEGER)');
  db.run('CREATE TABLE group_members (id INTEGER PRIMARY KEY, groupId INTEGER, userId INTEGER)');
});

const generateToken = user => jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '12h' });
const auth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Missing token' });
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Invalid token' });
    req.user = decoded; next();
  });
};

app.post('/signup', (req, res) => {
  const { email, password, userCode } = req.body;
  if (!email || !password || !userCode) return res.status(400).json({ message: 'Missing fields' });
  db.run('INSERT INTO users (email, password, userCode) VALUES (?, ?, ?)', [email, password, userCode], function (err) {
    if (err) return res.status(400).json({ message: 'Email or user code already exists' });
    const user = { id: this.lastID, email, userCode };
    res.json({ token: generateToken(user) });
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT id, email, userCode FROM users WHERE email = ? AND password = ?', [email, password], (err, user) => {
    if (err || !user) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ token: generateToken(user) });
  });
});

app.get('/me', auth, (req, res) => {
  db.get('SELECT id, email, userCode FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  });
});

app.post('/friends', auth, (req, res) => {
  const { friendCode } = req.body;
  db.get('SELECT id FROM users WHERE userCode = ?', [friendCode], (err, friend) => {
    if (err || !friend) return res.status(404).json({ message: 'Friend code not found' });
    db.run('INSERT INTO friends (userId, friendId) VALUES (?, ?)', [req.user.id, friend.id], err2 => {
      if (err2) return res.status(400).json({ message: 'Already friends or invalid' });
      res.json({ success: true });
    });
  });
});

app.get('/friends', auth, (req, res) => {
  db.all(
    'SELECT u.id, u.email, u.userCode FROM users u JOIN friends f ON u.id = f.friendId WHERE f.userId = ?',
    [req.user.id],
    (err, rows) => {
      res.json(rows || []);
    }
  );
});

app.post('/groups', auth, (req, res) => {
  const { name } = req.body;
  db.run('INSERT INTO groups (name, ownerId) VALUES (?, ?)', [name, req.user.id], function (err) {
    if (err) return res.status(400).json({ message: 'Failed to create group' });
    db.run('INSERT INTO group_members (groupId, userId) VALUES (?, ?)', [this.lastID, req.user.id]);
    res.json({ success: true });
  });
});

app.get('/groups', auth, (req, res) => {
  db.all(
    'SELECT g.id, g.name FROM groups g JOIN group_members gm ON g.id = gm.groupId WHERE gm.userId = ?',
    [req.user.id],
    (err, rows) => {
      res.json(rows || []);
    }
  );
});

app.get('/token', auth, (req, res) => {
  const { channel } = req.query;
  if (!channel) return res.status(400).json({ message: 'Missing channel' });
  if (!AGORA_APP_ID || AGORA_APP_ID === 'YOUR_AGORA_APP_ID' || !AGORA_APP_CERTIFICATE || AGORA_APP_CERTIFICATE === 'YOUR_AGORA_APP_CERTIFICATE') {
    return res.status(500).json({ message: 'Agora credentials are not configured on the server' });
  }

  const expirationTimeInSeconds = 3600;
  const privilegeExpiredTs = Math.floor(Date.now() / 1000) + expirationTimeInSeconds;
  const uid = Math.floor(Math.random() * 100000) + 1;
  const token = RtcTokenBuilder.buildTokenWithUid(
    AGORA_APP_ID,
    AGORA_APP_CERTIFICATE,
    channel,
    uid,
    RtcRole.PUBLISHER,
    privilegeExpiredTs
  );

  res.json({ token, uid });
});

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
