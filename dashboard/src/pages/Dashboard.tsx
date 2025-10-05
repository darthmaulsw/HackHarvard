import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, User, Phone, Calendar, Shield, Hand } from 'lucide-react'
import OTPDialogDemo from '../components/OTPDialogDemo'

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
  }

  const handleRegisterPalm = () => {
    navigate('/registerpalm')
  }

  return (
    <div className="min-h-screen p-4">
      <div className="container mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Palm Recognition Dashboard
            </h1>
            <p className="text-white/80">
              Welcome back! Manage your palm recognition settings.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn- text-white"
          >
            <LogOut className="w-4 h-4 text-white" />
            Logout
          </button>
        </div>


        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Information Section */}
          <div className="card p-6">
            <h3 className="text-xl font-semibold text-white mb-4">
              Personal Information
            </h3>
            <p className="text-white/70 mb-6">
              Your verified account details and personal information.
            </p>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                <Phone className="w-5 h-5 text-white/70" />
                <div>
                  <p className="text-white/70 text-sm">Phone Number</p>
                  <p className="text-white font-medium">
                    {user?.phoneNumber ? 
                      `(${user.phoneNumber.slice(0, 3)}) ${user.phoneNumber.slice(3, 6)}-${user.phoneNumber.slice(6)}` :
                      'Not available'
                    }
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                <Shield className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-white/70 text-sm">Verification Status</p>
                  <p className="text-green-400 font-medium">Verified</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                <Calendar className="w-5 h-5 text-white/70" />
                <div>
                  <p className="text-white/70 text-sm">Member Since</p>
                  <p className="text-white font-medium">
                    {user?.createdAt ? 
                      new Date(user.createdAt).toLocaleDateString() :
                      'Not available'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Palm Recognition Section */}
          <div className="card p-6">
            <h3 className="text-xl font-semibold text-white mb-4">
              Palm Recognition
            </h3>
            <p className="text-white/70 mb-6">
              Manage your palm recognition settings and view your registered palms.
            </p>
            
            <div className="space-y-4">
              <button 
                onClick={handleRegisterPalm}
                className="btn btn-primary w-full flex items-center justify-center gap-2 py-4 text-lg"
              >
                <Hand className="w-5 h-5" />
                Register New Palm
              </button>
              <button className="btn btn-secondary w-full py-4 text-lg">
                View Registered Palms
              </button>
              <button className="btn btn-secondary w-full py-4 text-lg">
                Recognition History
              </button>
            </div>
          </div>

        </div>

        {/* Coming Soon Notice */}
        <div className="card p-6 mt-8 text-center">
          <h3 className="text-lg font-semibold text-white mb-2">
            🚀 More Features Coming Soon
          </h3>
          <p className="text-white/70">
            We're working hard to bring you more palm recognition features. 
            Stay tuned for updates!
          </p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
