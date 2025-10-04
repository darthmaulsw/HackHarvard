# Palm Recognition Dashboard

A modern web application for palm recognition with phone number authentication using Twilio.

## 🚀 Features

- **Phone Number Authentication**: Secure sign-up using SMS verification via Twilio
- **Modern UI**: Beautiful, responsive interface built with React and TypeScript
- **Real-time Verification**: 6-digit SMS code verification with auto-focus inputs
- **Protected Routes**: JWT-based authentication with protected dashboard
- **Mobile-First Design**: Optimized for both desktop and mobile devices

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **React Router** for navigation
- **Lucide React** for icons
- **Axios** for API calls

### Backend
- **Node.js** with Express
- **Twilio Verify API** for SMS authentication
- **JWT** for token-based authentication
- **CORS** enabled for cross-origin requests

## 📋 Prerequisites

Before you begin, ensure you have:

1. **Node.js** (v18 or higher)
2. **Twilio Account** with Verify service enabled
3. **Twilio Credentials**:
   - Account SID
   - Auth Token
   - Verify Service SID

## 🔧 Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd dashboard
npm install
```

### 2. Twilio Setup

1. **Create a Twilio Account** at [twilio.com](https://www.twilio.com)
2. **Enable Verify Service**:
   - Go to Console → Verify → Services
   - Create a new Verify Service
   - Note down the Service SID
3. **Get your credentials**:
   - Account SID and Auth Token from Console Dashboard

### 3. Environment Configuration

1. **Copy the example environment file**:
   ```bash
   cp env.example .env
   ```

2. **Update `.env` with your Twilio credentials**:
   ```env
   TWILIO_ACCOUNT_SID=your_account_sid_here
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid_here
   JWT_SECRET=your-super-secret-jwt-key
   ```

### 4. Install Server Dependencies

```bash
# Install server dependencies
npm install express cors twilio jsonwebtoken dotenv
npm install -D nodemon
```

### 5. Development

**Start the backend server**:
```bash
node server.js
# or for development with auto-restart:
npx nodemon server.js
```

**Start the frontend** (in a new terminal):
```bash
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api

## 📱 Usage

### 1. Sign Up
- Enter your 10-digit US phone number
- Click "Send Verification Code"
- You'll receive an SMS with a 6-digit code

### 2. Verify Phone
- Enter the 6-digit code from SMS
- Click "Verify Code"
- You'll be redirected to the dashboard

### 3. Dashboard
- View your account information
- Access palm recognition features (coming soon)
- Manage security settings

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Phone Verification**: SMS-based two-factor authentication
- **Protected Routes**: Automatic redirect for unauthenticated users
- **Input Validation**: Client and server-side validation
- **Rate Limiting**: Built-in protection against spam

## 📁 Project Structure

```
dashboard/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── PhoneInput.tsx   # Phone number input with formatting
│   │   ├── CodeInput.tsx    # 6-digit verification code input
│   │   └── ProtectedRoute.tsx # Route protection component
│   ├── contexts/            # React contexts
│   │   └── AuthContext.tsx  # Authentication state management
│   ├── pages/               # Page components
│   │   ├── SignUp.tsx       # Phone number entry page
│   │   ├── VerifyCode.tsx   # Code verification page
│   │   └── Dashboard.tsx    # Main dashboard page
│   ├── services/            # API services
│   │   └── authApi.ts       # Authentication API calls
│   ├── types/               # TypeScript type definitions
│   │   └── auth.ts          # Authentication types
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # App entry point
│   └── index.css            # Global styles
├── server.js                # Express server with Twilio integration
├── package.json             # Frontend dependencies
├── server-package.json      # Backend dependencies
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
└── README.md                # This file
```

## 🚀 Deployment

### Frontend (Vercel/Netlify)
```bash
npm run build
# Deploy the 'dist' folder
```

### Backend (Heroku/Railway)
```bash
# Set environment variables in your hosting platform
# Deploy the server.js file
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID | Yes |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token | Yes |
| `TWILIO_VERIFY_SERVICE_SID` | Your Twilio Verify Service SID | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `PORT` | Server port (default: 5000) | No |
| `NODE_ENV` | Environment (development/production) | No |

### Twilio Verify Service Setup

1. **Create Verify Service**:
   ```bash
   # Using Twilio CLI
   twilio api:verify:v2:services:create --friendly-name "Palm Recognition Auth"
   ```

2. **Configure Service**:
   - Set SMS as primary channel
   - Configure rate limits if needed
   - Set custom message templates (optional)

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid phone number format"**
   - Ensure phone number is 10 digits (US format)
   - Check Twilio account has SMS enabled

2. **"Failed to send verification code"**
   - Verify Twilio credentials are correct
   - Check Verify Service SID is valid
   - Ensure account has sufficient balance

3. **"Invalid verification code"**
   - Code expires after 10 minutes
   - Use "Resend Code" if needed
   - Ensure code is exactly 6 digits

4. **CORS errors**
   - Check API URL configuration
   - Ensure backend server is running
   - Verify proxy settings in vite.config.ts

### Debug Mode

Enable debug logging:
```bash
DEBUG=* node server.js
```

## 📞 Support

For issues related to:
- **Twilio**: Check [Twilio Documentation](https://www.twilio.com/docs)
- **React/TypeScript**: Check [React Documentation](https://react.dev)
- **This Project**: Create an issue in the repository

## 📄 License

This project is part of the HackHarvard submission. Please refer to the main project license.

## 🙏 Acknowledgments

- **Twilio** for SMS verification services
- **React Team** for the amazing framework
- **Vite** for the fast build tool
- **Lucide** for the beautiful icons
