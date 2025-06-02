const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const nodemailer = require('nodemailer');

const app = express();

// === Create data directory if it doesn't exist ===
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// === Middleware Setup ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// === File paths ===
const USERS_JSON = path.join(dataDir, 'users.json');
const USERS_CSV = path.join(dataDir, 'users.csv');

// === Email Transporter ===
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'achhutanandjha1@gmail.com', // ✅ Add your Gmail address
        pass: 'xhjd zsms lnvd cxmz'  // ✅ Use app-specific password
    }
});

// === OTP Store ===
const otpStore = {};

// === OTP Generator ===
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// === Send Email Function ===
async function sendEmailOTP(email, otp) {
    try {
        await transporter.sendMail({
            from: 'your_email@gmail.com',
            to: email,
            subject: 'Your OTP for Appliance Repair Service',
            html: `<p>Your OTP is: <strong>${otp}</strong></p>`
        });
        return true;
    } catch (err) {
        console.error('Email sending failed:', err);
        return false;
    }
}

// === Routes ===

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// === Send OTP ===
app.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

        const otp = generateOTP();
        otpStore[email] = {
            otp,
            expiresAt: Date.now() + 300000 // 5 minutes
        };

        const sent = await sendEmailOTP(email, otp);
        if (sent) {
            return res.json({ success: true, message: 'OTP sent successfully' });
        } else {
            return res.status(500).json({ success: false, message: 'Failed to send OTP' });
        }

    } catch (err) {
        console.error('Send OTP Error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// === Verify OTP ===
app.post('/verify-otp', (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ success: false, message: 'Email and OTP are required' });
        }

        const storedOtp = otpStore[email];
        if (!storedOtp || !storedOtp.otp || !storedOtp.expiresAt) {
            return res.status(400).json({ success: false, message: 'OTP expired or invalid' });
        }

        if (Date.now() > storedOtp.expiresAt) {
            delete otpStore[email];
            return res.status(400).json({ success: false, message: 'OTP expired' });
        }

        if (storedOtp.otp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        delete otpStore[email];
        return res.json({ success: true, message: 'OTP verified successfully' });

    } catch (err) {
        console.error('Verify OTP Error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// === Signup ===
app.post('/signup', (req, res) => {
    try {
        const { name, email, phone, password, confirmPassword, role } = req.body;

        if (!name || !email || !phone || !password || !confirmPassword || !role) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match' });
        }

        let users = [];

if (fs.existsSync(USERS_JSON)) {
    try {
        const fileContent = fs.readFileSync(USERS_JSON, 'utf-8');
        users = fileContent.trim() ? JSON.parse(fileContent) : [];
    } catch (error) {
        console.error('Failed to read or parse users.json:', error);
        users = [];
    }
}


        const newUser = {
            id: Date.now().toString(),
            name,
            email,
            phone,
            password, // ⚠️ Hash this in production
            role,
            createdAt: new Date().toISOString(),
            verified: true
        };

        users.push(newUser);
        fs.writeFileSync(USERS_JSON, JSON.stringify(users, null, 2));

        const csvHeader = !fs.existsSync(USERS_CSV) ? Object.keys(newUser).join(',') + '\n' : '';
        const csvRow = Object.values(newUser).join(',') + '\n';
        fs.appendFileSync(USERS_CSV, csvHeader + csvRow);

        return res.json({ success: true, message: 'Registration successful' });

    } catch (err) {
        console.error('Signup Error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// === Login ===
app.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        if (!fs.existsSync(USERS_JSON)) {
            return res.status(400).json({ success: false, message: 'No users found' });
        }

        const users = JSON.parse(fs.readFileSync(USERS_JSON));
        const user = users.find(u => u.email === email && u.password === password);

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        return res.json({
            success: true,
            message: 'Login successful',
            user: req.session.user
        });

    } catch (err) {
        console.error('Login Error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// === Start Server ===
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
