const path = require('path');
const express = require('express');
const { SMTPServer } = require('smtp-server');
const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const cors = require('cors');
const db = require('./models/database');

const app = express();

// Hard-coded production configuration
const WEB_PORT = 10000;
const SMTP_PORT = 2525;
const JWT_SECRET = 'tiyenitickets-jwt-secret-key-production';
const IS_PRODUCTION = true;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Configure session with SQLite store
app.use(session({
    store: new SQLiteStore({
        dir: './data',
        db: 'sessions.db',
        table: 'sessions'
    }),
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: IS_PRODUCTION,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    console.log('Auth header:', authHeader);
    console.log('Token:', token);

    if (!token) {
        console.log('No token provided');
        return res.status(401).json({ error: 'Access denied - No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Successfully decoded token:', decoded);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(403).json({ error: 'Invalid token - ' + error.message });
    }
};

// Web Routes
app.get('/', (req, res) => res.render('login'));
app.get('/register', (req, res) => res.render('register'));
app.get('/dashboard', (req, res) => {
    res.render('dashboard');
});

// Add a new route to fetch user data
app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        const user = await getUserById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const emails = await getEmails(user.email);
        res.json({ user, emails });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// API Routes
app.post('/api/users', async (req, res) => {
    const { email, password, name } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
            [email, hashedPassword, name],
            (err) => {
                if (err) return res.status(400).json({ error: 'User already exists' });
                res.status(201).json({ message: 'User created successfully' });
            });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });
        
        const token = jwt.sign({ 
            userId: user.id,
            email: user.email 
        }, JWT_SECRET);
        res.json({ token });
    });
});

app.get('/api/emails', authenticateToken, (req, res) => {
    const { folder = 'inbox' } = req.query;
    let query;
    let params;

    if (folder === 'sent') {
        query = 'SELECT * FROM emails WHERE from_email = ? AND folder = ? ORDER BY received_date DESC';
        params = [req.user.email, 'sent'];
    } else {
        query = 'SELECT * FROM emails WHERE to_email = ? AND folder = ? ORDER BY received_date DESC';
        params = [req.user.email, folder];
    }

    db.all(query, params, (err, emails) => {
        if (err) {
            console.error('Error fetching emails:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        res.json(emails);
    });
});

app.get('/api/emails/:id', authenticateToken, (req, res) => {
    db.get('SELECT * FROM emails WHERE id = ?', [req.params.id], (err, email) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        if (!email) return res.status(404).json({ error: 'Email not found' });
        
        // Mark email as read
        db.run('UPDATE emails SET read = 1 WHERE id = ?', [req.params.id]);
        res.json(email);
    });
});

app.delete('/api/emails/:id', authenticateToken, (req, res) => {
    db.run(
        'UPDATE emails SET folder = ? WHERE id = ?',
        ['trash', req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: 'Server error' });
            res.json({ message: 'Email moved to trash' });
        }
    );
});

// SMTP Server configuration
const smtpServer = new SMTPServer({
    secure: false,
    size: 50 * 1024 * 1024, // 50MB max email size
    authOptional: true, // Make authentication optional
    disabledCommands: ['STARTTLS'], // Disable STARTTLS requirement
    onAuth(auth, session, callback) {
        if (!auth) {
            // Allow unauthenticated for local testing
            return callback(null, { user: 'anonymous' });
        }
        db.get('SELECT * FROM users WHERE email = ?', [auth.username], async (err, user) => {
            if (err || !user) return callback(new Error('Invalid username or password'));
            const match = await bcrypt.compare(auth.password, user.password);
            if (!match) return callback(new Error('Invalid username or password'));
            callback(null, { user: auth.username });
        });
    },
    onMailFrom(address, session, callback) {
        // Allow sending from authenticated user's email
        callback();
    },
    onRcptTo(address, session, callback) {
        // Accept all recipients for now
        callback();
    },
    onData(stream, session, callback) {
        simpleParser(stream).then(parsed => {
            const { from, to, subject, text, html } = parsed;
            db.run(
                'INSERT INTO emails (from_email, to_email, subject, body, html, folder) VALUES (?, ?, ?, ?, ?, ?)',
                [from.text, to.text, subject, text, html, 'inbox'],
                callback
            );
        }).catch(callback);
    }
});

// Update SMTP transport configuration
const smtpTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'rbitah@gmail.com',
        pass: 'nmrn gdbr hsdw vite'  // Gmail App Password
    },
    debug: true,
    logger: true
});

// Add a backup local transport for internal emails
const localSmtpTransport = nodemailer.createTransport({
    host: 'localhost',
    port: SMTP_PORT,
    secure: false,
    ignoreTLS: true,
    requireTLS: false,
    debug: true,
    logger: true
});

// Add health check endpoint for Render
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        web: true,
        smtp: smtpServer.listening,
        database: db?.open
    });
});

// Update send email endpoint to use appropriate transport
app.post('/api/send-email', authenticateToken, async (req, res) => {
    const { to, subject, text } = req.body;
    
    try {
        const mailOptions = {
            from: {
                name: req.user.name || 'TiyeniTickets Mail',
                address: req.user.email
            },
            to: to,
            subject: subject,
            text: text,
            envelope: {
                from: req.user.email,
                to: to
            }
        };

        console.log('Attempting to send email:', mailOptions);
        
        // Choose transport based on recipient domain
        const isInternalEmail = to.endsWith('@tiyenitickets.site');
        const transport = isInternalEmail ? localSmtpTransport : smtpTransport;
        
        const info = await transport.sendMail(mailOptions);
        console.log('Email sent successfully:', info);

        // Store in sent folder
        db.run(
            'INSERT INTO emails (from_email, to_email, subject, body, folder) VALUES (?, ?, ?, ?, ?)',
            [req.user.email, to, subject, text, 'sent'],
            (err) => {
                if (err) {
                    console.error('Error storing sent email:', err);
                }
            }
        );

        res.json({ message: 'Email sent successfully', info });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send email: ' + error.message });
    }
});

// Helper functions
async function getUserById(id) {
    return new Promise((resolve, reject) => {
        db.get('SELECT id, email, name FROM users WHERE id = ?', [id], (err, user) => {
            if (err) reject(err);
            resolve(user);
        });
    });
}

async function getEmails(email) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM emails WHERE to_email = ? ORDER BY received_date DESC', [email], (err, emails) => {
            if (err) reject(err);
            resolve(emails);
        });
    });
}

// Start servers with proper error handling
const startServers = async () => {
    try {
        // Start web server
        await new Promise((resolve, reject) => {
            const webServer = app.listen(WEB_PORT, () => {
                console.log(`Web server listening on port ${WEB_PORT}`);
                resolve();
            });
            webServer.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.error(`Port ${WEB_PORT} is already in use for web server`);
                }
                reject(error);
            });
        });

        // Start SMTP server
        await new Promise((resolve, reject) => {
            smtpServer.listen(SMTP_PORT, '0.0.0.0', () => {
                console.log(`SMTP server listening on port ${SMTP_PORT}`);
                resolve();
            });
            smtpServer.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.error(`Port ${SMTP_PORT} is already in use for SMTP server`);
                }
                reject(error);
            });
        });
    } catch (error) {
        console.error('Failed to start servers:', error);
        process.exit(1);
    }
};

// Start the servers
startServers();