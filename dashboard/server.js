// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

if (!accountSid || !authToken || !serviceSid) {
  console.error('Missing Twilio configuration. Please set:');
  console.error('- TWILIO_ACCOUNT_SID');
  console.error('- TWILIO_AUTH_TOKEN');
  console.error('- TWILIO_VERIFY_SERVICE_SID');
  process.exit(1);
}

const client = twilio(accountSid, authToken);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// In-memory storage (replace with database in production)
const users = new Map();
const pendingVerifications = new Map();

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      phoneNumber: user.phoneNumber 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Helper function to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Routes

// Send verification code
app.post('/api/auth/send-code', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber || phoneNumber.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit phone number'
      });
    }

    // Format phone number for Twilio (add +1 for US)
    const formattedPhone = `+1${phoneNumber}`;

    // Send verification code using Twilio Verify
    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications
      .create({
        to: formattedPhone,
        channel: 'sms'
      });

    // Store pending verification
    pendingVerifications.set(phoneNumber, {
      phoneNumber,
      status: verification.status,
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: 'Verification code sent successfully'
    });

  } catch (error) {
    console.error('Error sending verification code:', error);
    
    let message = 'Failed to send verification code';
    if (error.code === 60200) {
      message = 'Invalid phone number format';
    } else if (error.code === 60203) {
      message = 'Phone number is not reachable';
    }

    res.status(500).json({
      success: false,
      message
    });
  }
});

// Verify code
app.post('/api/auth/verify-code', async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and code are required'
      });
    }

    if (code.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Code must be 6 digits'
      });
    }

    const formattedPhone = `+1${phoneNumber}`;

    // Verify the code using Twilio Verify
    const verificationCheck = await client.verify.v2
      .services(serviceSid)
      .verificationChecks
      .create({
        to: formattedPhone,
        code: code
      });

    if (verificationCheck.status === 'approved') {
      // Create or update user
      const userId = `user_${phoneNumber}_${Date.now()}`;
      const user = {
        id: userId,
        phoneNumber,
        isVerified: true,
        createdAt: new Date().toISOString()
      };

      users.set(phoneNumber, user);
      pendingVerifications.delete(phoneNumber);

      // Generate JWT token
      const token = generateToken(user);

      res.json({
        success: true,
        message: 'Phone number verified successfully',
        data: {
          user,
          token
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

  } catch (error) {
    console.error('Error verifying code:', error);
    
    let message = 'Failed to verify code';
    if (error.code === 60202) {
      message = 'Invalid verification code';
    } else if (error.code === 20404) {
      message = 'No verification found for this phone number';
    }

    res.status(500).json({
      success: false,
      message
    });
  }
});

// Verify token (protected route)
app.get('/api/auth/verify-token', verifyToken, (req, res) => {
  const { phoneNumber } = req.user;
  const user = users.get(phoneNumber);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    data: user
  });
});

// Resend verification code
app.post('/api/auth/resend-code', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber || phoneNumber.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit phone number'
      });
    }

    const formattedPhone = `+1${phoneNumber}`;

    // Send verification code using Twilio Verify
    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications
      .create({
        to: formattedPhone,
        channel: 'sms'
      });

    // Update pending verification
    pendingVerifications.set(phoneNumber, {
      phoneNumber,
      status: verification.status,
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: 'Verification code resent successfully'
    });

  } catch (error) {
    console.error('Error resending verification code:', error);
    
    let message = 'Failed to resend verification code';
    if (error.code === 60200) {
      message = 'Invalid phone number format';
    } else if (error.code === 60203) {
      message = 'Phone number is not reachable';
    }

    res.status(500).json({
      success: false,
      message
    });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Twilio Verify Service SID: ${serviceSid}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
});

module.exports = app;
