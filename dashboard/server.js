// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, '..', 'palm_data', 'temp_images'),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

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

// Test mode configuration
const TEST_MODE = process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'development';
const TEST_PHONE_NUMBERS = [
  '5551234567',  // Test phone 1
  '5559876543',  // Test phone 2
  '5555555555',  // Test phone 3
  '8123443735'   // Your test phone
];

console.log(`🔧 Server running in ${TEST_MODE ? 'TEST MODE' : 'PRODUCTION MODE'}`);
if (TEST_MODE) {
  console.log('📱 Test phone numbers:', TEST_PHONE_NUMBERS.join(', '));
  console.log('🔑 Test verification code: 123456');
}

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

// Helper function to call Python palm API
const callPythonPalmAPI = (command, args = []) => {
  return new Promise((resolve, reject) => {
    console.log(`🐍 Calling Python API: ${command} ${args.join(' ')}`);
    
    const pythonPath = process.env.PYTHON_PATH || 'python';
    const scriptPath = path.join(__dirname, '..', 'palm_api.py');
    const pythonArgs = [scriptPath, command, ...args];
    
    console.log(`🐍 Python command: ${pythonPath} ${pythonArgs.join(' ')}`);
    
    const python = spawn(pythonPath, pythonArgs);
    
    let stdout = '';
    let stderr = '';
    
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(`🐍 Python stderr: ${data.toString()}`);
    });
    
    python.on('close', (code) => {
      console.log(`🐍 Python process exited with code ${code}`);
      
      if (code !== 0) {
        console.error(`❌ Python error: ${stderr}`);
        reject(new Error(`Python process failed with code ${code}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        console.log(`✅ Python result:`, result);
        resolve(result);
      } catch (error) {
        console.error(`❌ Failed to parse Python output: ${stdout}`);
        reject(new Error('Failed to parse Python response'));
      }
    });
    
    python.on('error', (error) => {
      console.error(`❌ Failed to start Python process:`, error);
      reject(error);
    });
  });
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

    // Test mode: Use mock verification
    if (TEST_MODE) {
      console.log(`🧪 TEST MODE: Mock SMS sent to ${phoneNumber}`);
      
      // Store pending verification with mock status
      pendingVerifications.set(phoneNumber, {
        phoneNumber,
        status: 'pending',
        createdAt: new Date(),
        isTestMode: true
      });

      return res.json({
        success: true,
        message: `Test verification code sent to ${phoneNumber}. Use code: 123456`
      });
    }

    // Production mode: Use real Twilio
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
    } else if (error.message.includes('Too many requests')) {
      message = 'Rate limit exceeded. Please try again later or use test mode.';
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

    // Test mode: Accept any code for test phone numbers
    if (TEST_MODE) {
      const pendingVerification = pendingVerifications.get(phoneNumber);
      
      if (!pendingVerification) {
        return res.status(400).json({
          success: false,
          message: 'No verification found for this phone number'
        });
      }

      // In test mode, accept any 6-digit code
      console.log(`🧪 TEST MODE: Verifying code ${code} for ${phoneNumber}`);
      
      // Create or update user
      const userId = `user_${phoneNumber}_${Date.now()}`;
      const user = {
        id: userId,
        phoneNumber,
        isVerified: true,
        createdAt: new Date().toISOString(),
        isTestUser: true
      };

      users.set(phoneNumber, user);
      pendingVerifications.delete(phoneNumber);

      // Generate JWT token
      const token = generateToken(user);

      return res.json({
        success: true,
        message: 'Phone number verified successfully (Test Mode)',
        data: {
          user,
          token
        }
      });
    }

    // Production mode: Use real Twilio verification
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

    // Test mode: Use mock resend
    if (TEST_MODE) {
      console.log(`🧪 TEST MODE: Mock resend SMS to ${phoneNumber}`);
      
      // Update pending verification with mock status
      pendingVerifications.set(phoneNumber, {
        phoneNumber,
        status: 'pending',
        createdAt: new Date(),
        isTestMode: true
      });

      return res.json({
        success: true,
        message: `Test verification code resent to ${phoneNumber}. Use code: 123456`
      });
    }

    // Production mode: Use real Twilio
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

// Palm Registration Endpoints

// Register palm (no auth required for demo)
app.post('/api/palm/register', upload.single('image'), async (req, res) => {
  console.log('📱 Palm registration request received');
  console.log('📎 File:', req.file);
  console.log('📋 Body:', req.body);
  
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      console.error('❌ No phone number provided');
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }
    
    if (!req.file) {
      console.error('❌ No image file uploaded');
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }
    
    console.log(`📸 Processing palm registration for ${phoneNumber}`);
    console.log(`📁 Image saved to: ${req.file.path}`);
    
    // Call Python API to register palm
    const result = await callPythonPalmAPI('register', [req.file.path, phoneNumber]);
    
    // Clean up uploaded file
    try {
      await fs.unlink(req.file.path);
      console.log(`🗑️  Cleaned up temporary file: ${req.file.path}`);
    } catch (cleanupError) {
      console.error(`⚠️  Failed to cleanup file: ${cleanupError.message}`);
    }
    
    if (result.success) {
      console.log(`✅ Palm registered successfully for ${phoneNumber}`);
      res.json(result);
    } else {
      // Check if it's an "already registered" message
      if (result.message && result.message.includes('already registered')) {
        console.log(`ℹ️  Palm already registered for ${phoneNumber}`);
        res.json(result); // Return 200 with success:false for already registered
      } else {
        console.error(`❌ Palm registration failed: ${result.message}`);
        res.status(400).json(result);
      }
    }
    
  } catch (error) {
    console.error('❌ Palm registration error:', error);
    
    // Clean up file if it exists
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error(`⚠️  Failed to cleanup file: ${cleanupError.message}`);
      }
    }
    
    res.status(500).json({
      success: false,
      message: `Registration failed: ${error.message}`
    });
  }
});

// Recognize palm (no auth required for demo)
app.post('/api/palm/recognize', upload.single('image'), async (req, res) => {
  console.log('🔍 Palm recognition request received');
  console.log('📎 File:', req.file);
  console.log('📋 Body:', req.body);
  
  try {
    const { phoneNumber } = req.body;
    
    if (!req.file) {
      console.error('❌ No image file uploaded');
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }
    
    console.log(`🔍 Processing palm recognition for ${phoneNumber}`);
    console.log(`📁 Image saved to: ${req.file.path}`);
    
    // Call Python API to recognize palm (match against specific phone number)
    const threshold = req.body.threshold || '0.13';
    const result = await callPythonPalmAPI('recognize', [req.file.path, phoneNumber, threshold]);
    
    // Clean up uploaded file
    try {
      await fs.unlink(req.file.path);
      console.log(`🗑️  Cleaned up temporary file: ${req.file.path}`);
    } catch (cleanupError) {
      console.error(`⚠️  Failed to cleanup file: ${cleanupError.message}`);
    }
    
    if (result.success) {
      console.log(`✅ Palm recognition completed for ${phoneNumber}`);
      res.json(result);
    } else {
      console.error(`❌ Palm recognition failed: ${result.message}`);
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('❌ Palm recognition error:', error);
    
    // Clean up file if it exists
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error(`⚠️  Failed to cleanup file: ${cleanupError.message}`);
      }
    }
    
    res.status(500).json({
      success: false,
      message: `Recognition failed: ${error.message}`
    });
  }
});

// Check palm registration status (no auth required for demo)
app.get('/api/palm/status/:phoneNumber', async (req, res) => {
  console.log('📊 Palm status check');
  console.log('📋 Params:', req.params);
  
  try {
    const { phoneNumber } = req.params;
    const palmDataPath = path.join(__dirname, '..', 'palm_data', `${phoneNumber}.json`);
    
    try {
      await fs.access(palmDataPath);
      console.log(`✅ Palm registered for ${phoneNumber}`);
      
      // Read palm data to get registration details
      const palmData = JSON.parse(await fs.readFile(palmDataPath, 'utf8'));
      
      res.json({
        success: true,
        registered: true,
        data: {
          phoneNumber: palmData.phoneNumber,
          registeredAt: palmData.registeredAt,
          lastUsed: palmData.lastUsed
        }
      });
    } catch (accessError) {
      console.log(`❌ No palm registered for ${phoneNumber}`);
      res.json({
        success: true,
        registered: false
      });
    }
    
  } catch (error) {
    console.error('❌ Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check palm status'
    });
  }
});

// Delete palm registration (no auth required for demo)
app.delete('/api/palm/delete/:phoneNumber', async (req, res) => {
  console.log('🗑️  Palm deletion request');
  console.log('📋 Params:', req.params);
  
  try {
    const { phoneNumber } = req.params;
    
    // Call Python API to delete palm
    const result = await callPythonPalmAPI('delete', [phoneNumber]);
    
    if (result.success) {
      console.log(`✅ Palm deleted for ${phoneNumber}`);
      res.json(result);
    } else {
      console.error(`❌ Palm deletion failed: ${result.message}`);
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('❌ Palm deletion error:', error);
    res.status(500).json({
      success: false,
      message: `Deletion failed: ${error.message}`
    });
  }
});

// List all registered palms (admin endpoint - optional)
app.get('/api/palm/list', async (req, res) => {
  console.log('📋 List all palms request');
  
  try {
    const result = await callPythonPalmAPI('list', []);
    res.json(result);
  } catch (error) {
    console.error('❌ List palms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list palms'
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
