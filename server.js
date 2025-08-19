const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const { Client, LocalAuth } = require('whatsapp-web.js');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const LOG_FILE = './messageLog.txt';

// --- Middleware ---
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 week login
}));

function isAuthenticated(req, res, next) {
    if (req.session.loggedIn) return next();
    res.status(401).send('Not logged in');
}

// Serve static files
app.use(express.static('public'));

// --- Login Route ---
app.post('/api/login', (req, res) => {
    const { name, mobile, password } = req.body;
    if (name === process.env.ADMIN_NAME &&
        mobile === process.env.ADMIN_MOBILE &&
        password === process.env.ADMIN_PASS) {
        req.session.loggedIn = true;
        res.sendStatus(200);
    } else {
        res.status(401).send('Invalid credentials');
    }
});

// --- API: Get Logs ---
app.get('/api/log', isAuthenticated, (req, res) => {
    if (fs.existsSync(LOG_FILE)) {
        res.json(fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean));
    } else {
        res.json([]);
    }
});

// --- API: Delete Logs ---
app.delete('/api/delete-log', isAuthenticated, (req, res) => {
    fs.writeFileSync(LOG_FILE, '');
    io.emit('logUpdate', []);
    res.sendStatus(200);
});

// --- API: Download Log ---
app.get('/api/download-log', isAuthenticated, (req, res) => {
    res.download(LOG_FILE, 'messageLog.txt');
});

// --- WhatsApp Client ---
let isAuthenticatedWA = false;
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

client.on('qr', (qr) => {
    io.emit('qr', qr);
    isAuthenticatedWA = false;
});

client.on('ready', () => {
    isAuthenticatedWA = true;
    io.emit('authenticated');
    console.log('✅ WhatsApp connected!');
});

client.on('disconnected', () => {
    isAuthenticatedWA = false;
    io.emit('logout');
    client.initialize();
});

client.on('message', async msg => {
    let senderName = msg.from;  // Default to raw ID as fallback

    try {
        if (msg.from.endsWith('@g.us')) {
            // It's a group
            const chat = await client.getChatById(msg.from);
            senderName = chat.name || msg.from;  // Use group name or fallback
        } else {
            // It's an individual contact
            const contact = await client.getContactById(msg.from);
            senderName = contact.name || contact.pushname || msg.from;  // Prioritize saved name, then pushname, then ID
        }
    } catch (error) {
        console.error('Error fetching sender name:', error);
        // Fallback remains the raw ID
    }

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const entry = `[${timestamp}] ${senderName}: ${msg.body}\n`;
    fs.appendFileSync(LOG_FILE, entry);
    io.emit('logUpdate', readLogFile());
});

function readLogFile() {
    if (fs.existsSync(LOG_FILE)) {
        return fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
    }
    return [];
}

// --- Socket.IO ---
io.on('connection', (socket) => {
    socket.emit('authenticated', isAuthenticatedWA);
    socket.emit('logUpdate', readLogFile());
});

client.initialize();

server.listen(process.env.PORT, () =>
    console.log(`🚀 Server running on http://localhost:${process.env.PORT}`)
);
