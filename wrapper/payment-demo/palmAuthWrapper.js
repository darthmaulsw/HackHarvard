/**
 * PalmAuth Payment Wrapper
 * Locks payment section until authentication/verification is complete
 */
class PalmAuthWrapper {
    constructor(options = {}) {
        this.options = {
            paymentContainerId: 'paypal-button-container',
            statusMessageId: 'status-message',
            lockMessage: 'Please complete authentication to proceed with payment',
            unlockMessage: 'Authentication complete. You may now proceed with payment.',
            palmRecognitionThreshold: 0.13, // Threshold for palm matching (13% tolerance)
            ...options
        };
        
        this.isLocked = true;
        this.paymentContainer = null;
        this.statusMessage = null;
        this.originalContent = null;
        this.lockOverlay = null;
        
        // Palm camera variables
        this.palmCountdownActive = false;
        this.palmCountdownTime = 0;
        this.palmCountdownInterval = null;
        this.palmCountdownCooldown = false;
        this.palmCountdownCooldownTimeout = null;
        this.authenticationCompleted = false;
        
        this.init();
    }
    
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupWrapper());
        } else {
            this.setupWrapper();
        }
    }
    
    setupWrapper() {
        this.paymentContainer = document.getElementById(this.options.paymentContainerId);
        this.statusMessage = document.getElementById(this.options.statusMessageId);
        
        if (!this.paymentContainer) {
            console.error('Payment container not found:', this.options.paymentContainerId);
            return;
        }
        
        // Store original content
        this.originalContent = this.paymentContainer.innerHTML;
        
        // Create lock overlay
        this.createLockOverlay();
        
        // Apply initial lock
        this.lock();
    }
    
     createLockOverlay() {
         this.lockOverlay = document.createElement('div');
         this.lockOverlay.className = 'palm-auth-lock-overlay';
         this.lockOverlay.innerHTML = `
             <div class="lock-content">
                 <div class="lock-icon">🔒</div>
                 <div class="lock-message">${this.options.lockMessage}</div>
                 <div class="lock-actions">
                     <button id="start-auth-btn" class="palm-auth-button">Start Authentication</button>
                 </div>
                 <div class="auth-steps-info">
                     <p style="font-size: 12px; color: #666; margin-top: 12px; line-height: 1.4;">
                         Step 1: Verify your phone number<br>
                         Step 2: Scan your palm for biometric verification
                     </p>
                 </div>
             </div>
         `;
         
         // Add styles
         this.addLockStyles();
         
         // Add event listeners for buttons
         this.lockOverlay.addEventListener('click', (e) => {
             if (e.target.id === 'start-auth-btn') {
                 this.startAuthenticationFlow();
             }
         });
     }
    
    addLockStyles() {
        if (document.getElementById('palm-auth-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'palm-auth-styles';
        style.textContent = `
            .palm-auth-lock-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(5px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                border-radius: 8px;
            }
            
            .lock-content {
                text-align: center;
                padding: 30px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                max-width: 300px;
                width: 100%;
            }
            
            .lock-icon {
                font-size: 48px;
                margin-bottom: 20px;
                opacity: 0.7;
            }
            
            .lock-message {
                font-size: 16px;
                color: #666;
                margin-bottom: 25px;
                line-height: 1.5;
            }
            
            .palm-auth-button {
                background: linear-gradient(135deg, #0070ba 0%, #003087 100%);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                width: 100%;
            }
            
            .palm-auth-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0, 112, 186, 0.3);
            }
            
            .palm-auth-button:active {
                transform: translateY(0);
            }
            
            .palm-auth-button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            
            .payment-section {
                position: relative;
            }
            
            .unlock-animation {
                animation: unlockPulse 0.6s ease-in-out;
            }
            
             @keyframes unlockPulse {
                 0% { transform: scale(1); }
                 50% { transform: scale(1.05); }
                 100% { transform: scale(1); }
             }
             
             /* Phone Verification Modal Styles */
             .phone-modal-overlay {
                 position: fixed;
                 top: 0;
                 left: 0;
                 right: 0;
                 bottom: 0;
                 background: rgba(0, 0, 0, 0.7);
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 z-index: 2000;
                 backdrop-filter: blur(5px);
             }
             
             .phone-modal-content {
                 background: white;
                 border-radius: 16px;
                 padding: 0;
                 max-width: 400px;
                 width: 90%;
                 max-height: 90vh;
                 overflow: hidden;
                 box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
                 animation: modalSlideIn 0.3s ease-out;
                 display: flex;
                 flex-direction: column;
             }
             
             @keyframes modalSlideIn {
                 from {
                     opacity: 0;
                     transform: translateY(-20px) scale(0.95);
                 }
                 to {
                     opacity: 1;
                     transform: translateY(0) scale(1);
                 }
             }
             
             .phone-modal-header {
                 background: linear-gradient(135deg, #0070ba 0%, #003087 100%);
                 color: white;
                 padding: 24px;
                 border-radius: 16px 16px 0 0;
                 text-align: center;
                 position: relative;
             }
             
             .phone-modal-header h2 {
                 margin: 0;
                 font-size: 24px;
                 font-weight: 600;
             }
             
             .phone-modal-header p {
                 margin: 8px 0 0 0;
                 opacity: 0.9;
                 font-size: 14px;
             }
             
             .phone-modal-close {
                 position: absolute;
                 top: 16px;
                 right: 16px;
                 background: none;
                 border: none;
                 color: white;
                 font-size: 24px;
                 cursor: pointer;
                 opacity: 0.7;
                 transition: opacity 0.3s ease;
             }
             
             .phone-modal-close:hover {
                 opacity: 1;
             }
             
             .phone-modal-body {
                 padding: 32px 24px;
                 flex: 1;
                 overflow-y: auto;
                 display: flex;
                 flex-direction: column;
             }
             
             .phone-form-group {
                 margin-bottom: 24px;
             }
             
             .phone-form-group label {
                 display: block;
                 font-weight: 600;
                 color: #333;
                 margin-bottom: 8px;
                 font-size: 14px;
             }
             
             .phone-form-input {
                 width: 100%;
                 padding: 12px 16px;
                 border: 2px solid #e1e5e9;
                 border-radius: 8px;
                 font-size: 16px;
                 transition: all 0.3s ease;
                 box-sizing: border-box;
             }
             
             .phone-form-input:focus {
                 outline: none;
                 border-color: #0070ba;
                 box-shadow: 0 0 0 3px rgba(0, 112, 186, 0.1);
             }
             
             .phone-form-input.error {
                 border-color: #dc3545;
             }
             
             .phone-error-message {
                 color: #dc3545;
                 font-size: 12px;
                 margin-top: 4px;
                 display: block;
             }
             
             .phone-success-message {
                 color: #28a745;
                 font-size: 12px;
                 margin-top: 4px;
                 display: block;
             }
             
             .phone-btn {
                 width: 100%;
                 padding: 14px 24px;
                 border: none;
                 border-radius: 8px;
                 font-size: 16px;
                 font-weight: 600;
                 cursor: pointer;
                 transition: all 0.3s ease;
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 gap: 8px;
             }
             
             .phone-btn-primary {
                 background: linear-gradient(135deg, #0070ba 0%, #003087 100%);
                 color: white;
             }
             
             .phone-btn-primary:hover:not(:disabled) {
                 transform: translateY(-2px);
                 box-shadow: 0 8px 25px rgba(0, 112, 186, 0.3);
             }
             
             .phone-btn-primary:disabled {
                 opacity: 0.6;
                 cursor: not-allowed;
                 transform: none;
             }
             
             .phone-btn-secondary {
                 background: #f8f9fa;
                 color: #6c757d;
                 border: 2px solid #e9ecef;
                 margin-top: 12px;
             }
             
             .phone-btn-secondary:hover:not(:disabled) {
                 background: #e9ecef;
                 border-color: #dee2e6;
             }
             
             .phone-spinner {
                 width: 16px;
                 height: 16px;
                 border: 2px solid transparent;
                 border-top: 2px solid currentColor;
                 border-radius: 50%;
                 animation: spin 1s linear infinite;
             }
             
             @keyframes spin {
                 to { transform: rotate(360deg); }
             }
             
             .phone-step-indicator {
                 display: flex;
                 justify-content: center;
                 margin-bottom: 24px;
             }
             
             .phone-step {
                 width: 8px;
                 height: 8px;
                 border-radius: 50%;
                 background: #e1e5e9;
                 margin: 0 4px;
                 transition: all 0.3s ease;
             }
             
             .phone-step.active {
                 background: #0070ba;
                 transform: scale(1.2);
             }
             
             .phone-step.completed {
                 background: #28a745;
             }
             
             .phone-modal-footer {
                 padding: 16px 24px 24px;
                 text-align: center;
             }
             
             .phone-modal-footer p {
                 margin: 0;
                 color: #6c757d;
                 font-size: 13px;
             }
         `;
         
         document.head.appendChild(style);
     }
    
    lock() {
        if (!this.paymentContainer || !this.lockOverlay) return;
        
        this.isLocked = true;
        this.paymentContainer.style.position = 'relative';
        this.paymentContainer.appendChild(this.lockOverlay);
        
        // Disable PayPal button if it exists
        this.disablePayPalButton();
        
        this.showStatus('Authentication required to proceed with payment', 'error');
    }
    
    unlock() {
        if (!this.paymentContainer || !this.lockOverlay) return;
        
        this.isLocked = false;
        
        // Remove lock overlay
        if (this.lockOverlay.parentNode) {
            this.lockOverlay.parentNode.removeChild(this.lockOverlay);
        }
        
        // Re-enable PayPal button
        this.enablePayPalButton();
        
        // Show success message
        this.showStatus(this.options.unlockMessage, 'success');
        
        // Add unlock animation
        this.paymentContainer.classList.add('unlock-animation');
        setTimeout(() => {
            this.paymentContainer.classList.remove('unlock-animation');
        }, 600);
        
        // Trigger custom event
        this.triggerEvent('palmAuthUnlocked');
    }
    
    disablePayPalButton() {
        // Disable PayPal buttons by adding a disabled class
        const paypalButtons = this.paymentContainer.querySelectorAll('[data-paypal-button]');
        paypalButtons.forEach(btn => {
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.5';
        });
    }
    
    enablePayPalButton() {
        // Re-enable PayPal buttons
        const paypalButtons = this.paymentContainer.querySelectorAll('[data-paypal-button]');
        paypalButtons.forEach(btn => {
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
        });
        
        // Clear any existing PayPal buttons to prevent duplication
        const existingPayPalContainer = this.paymentContainer.querySelector('#paypal-button-container');
        if (existingPayPalContainer) {
            existingPayPalContainer.innerHTML = '';
        }
    }
    
     showStatus(message, type = 'info') {
         if (!this.statusMessage) return;
         
         this.statusMessage.className = `status-message ${type}`;
         this.statusMessage.innerHTML = message;
         this.statusMessage.style.display = 'block';
     }
     
     // New Sequential Authentication Flow
     async startAuthenticationFlow() {
         this.authStep = 1; // 1 = phone verification, 2 = palm scanning
         this.phoneVerified = false;
         this.palmVerified = false;
         this.verifiedUser = null;
         this.authToken = null;
         this.authenticationCompleted = false; // Reset authentication flag
         
         // Check if server is running before starting
         const serverRunning = await this.checkServerHealth();
         if (!serverRunning) {
             this.showStatus('Server is not running. Please start the server and try again.', 'error');
             return;
         }
         
         this.showPhoneVerificationModal();
     }
     
     // Check if server is running
     async checkServerHealth() {
         try {
             const response = await fetch(`${this.getApiBaseUrl()}/health`);
             const data = await response.json();
             return data.success;
         } catch (error) {
             console.error('Server health check failed:', error);
             return false;
         }
     }
     
     // Get API base URL (can be configured)
     getApiBaseUrl() {
         return this.options.apiBaseUrl || 'http://localhost:5000/api';
     }
     
     onPhoneVerificationSuccess() {
         this.phoneVerified = true;
         this.authStep = 2;
         this.closePhoneModal();
         this.showPalmScanningModal();
     }
     
     showPalmScanningModal() {
         this.createPalmScanningModal();
     }
     
     createPalmScanningModal() {
         // Remove existing modal if any
         const existingModal = document.getElementById('palm-scanning-modal');
         if (existingModal) {
             existingModal.remove();
         }
         
         const modal = document.createElement('div');
         modal.id = 'palm-scanning-modal';
         modal.className = 'phone-modal-overlay';
         modal.innerHTML = `
             <div class="phone-modal-content">
                 <div class="phone-modal-header">
                     <button class="phone-modal-close" onclick="if(window.palmAuthWrapper) window.palmAuthWrapper.closePalmScanningModal()">&times;</button>
                     <h2>Hand Biometric Verification</h2>
                     <p>Step 2: Scan your palm to complete authentication</p>
                 </div>
                 
                 <div class="phone-modal-body">
                     <!-- Step Indicator -->
                     <div class="phone-step-indicator">
                         <div class="phone-step completed"></div>
                         <div class="phone-step active"></div>
                     </div>
 
                     <!-- Palm Scanning Interface -->
                     <div id="palm-scanning-interface">
                         <div class="palm-camera-container">
                             <video id="palm-video" autoplay muted playsinline style="display: none;"></video>
                             <div class="palm-placeholder" id="palm-placeholder">
                                 <div class="palm-icon">✋</div>
                                 <p>Click "Start Camera" to begin palm scanning</p>
                         </div>
                         
                             <!-- Hand Guide Overlay -->
                             <div class="palm-hand-guide" id="palm-hand-guide" style="display: none;">
                                 <svg class="palm-svg" viewBox="0 0 316.8 430.41" preserveAspectRatio="xMidYMid meet">
                                     <defs>
                                         <filter id="palm-glow">
                                             <feGaussianBlur stdDeviation="2" result="b"/>
                                             <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                                         </filter>
                                     </defs>
                                     <g id="palm-flip-left" transform="translate(-320,-20)">
                                         <!-- Live fingertip debug dots -->
                                         <g id="palm-debug-dots"></g>
                                         <!-- Fingertip targets -->
                                         <g id="palm-targets" fill="black">
                                             <circle id="pt0" cx="123" cy="238" r="12"/>
                                             <circle id="pt1" cx="123" cy="238" r="12"/>
                                             <circle id="pt2" cx="123" cy="238" r="12"/>
                                             <circle id="pt3" cx="123" cy="238" r="12"/>
                                             <circle id="pt4" cx="123" cy="238" r="12"/>
                                             <circle id="pt5" cx="123" cy="238" r="14"/>
                                         </g>
                                         <!-- Palm outline -->
                                         <path id="palm-outline" class="palm-outline"
                                            d="m293.12 154.31c-1.187-0.007-2.4908 0.14375-3.9062 0.46875-1.654 0.381-5.9352 3.7758-7.1562 5.7188-5.857 9.331-3.3628 32.779-3.5938 47.281 0.39025 15.233 2.9204 30.087 0.71875 44.438-5.7953 18.424 6.6761 79.039-10.719 55.906-3.865-13.098-3.7128-26.528-6.4688-39.438-2.313-10.837-7.553-18.441-10.75-29.375-3.253-11.125-4.0165-23.033-6.4375-36.531-2.5845-11.757-4.192-30.66-16.469-30.094-4.235 0.313-11.087 7.5565-12.906 12.188-2.338 5.955-2.7642 15.3-2.1562 24.344 0.506 7.548 2.6182 16.95 5.0312 26.531 2.226 8.834 2.6592 18.112 4.2812 27.219 1.958 11.007 3.6798 24.304 6.4688 35.844 1.106 4.581 1.4818 10.123 2.8438 16.469 1.735 8.072 3.9748 15.122-4.2812 17.906-9.868-4.702-13.419-16.71-17.473-27.228-4.0209-6.8333-15.709-23.025-19.808-31.522-5.5156-10.571-9.433-34.282-20.062-34.406-10.618 0.127-13.053 15.803-10.75 29.375 2.9086 13.013 10.359 23.442 15.781 34.406 7.894 15.721 15.691 34.516 24.344 50.875-0.27973 24.311 3.3662 45.243 5.75 68.062 1.189 9.402 3.8988 21.991 5.7188 32.25 4.8748 20.737 11.765 41.04 16.623 61.234 1.8913 7.8614 7.4745 15.706 8.511 23.553 0.49491 3.747 0.86513 7.4946 1.0846 11.245 0.291 4.541 0.13202 26.932 0.64102 31.6 2.7381 0.60062 2.6746 0.73178 4.3902 0.77474 1.344-12.563-0.56775-32.846-0.71875-44.562-1.5202-7.0776-7.273-14.302-9.1449-21.59-7.3446-28.597-16.522-58.18-20.668-83.753-0.826-5.373-1.4532-9.7765-2.1562-17.188-1.7211-16.896-6.8855-33.727-5.3125-49.594l-1.0938-13.5c-0.0109 0.01-0.0204 0.0215-0.0312 0.0312-2.315-5.895-5.7368-11.104-8.5938-17.188-2.664-5.674-4.2822-12.188-7.1562-18.625-6.6482-6.9826-8.3089-16.538-12.188-23.656-7.3226-9.9401-13.434-26.327-12.188-37.25 0.613-4.46 2.1814-11.269 5-12.188 2.8402-0.50157 4.2424 0.49634 5.75 1.4375 4.059 5.17 5.495 11.468 7.875 17.906 2.651 7.18 5.8822 16.75 10.031 22.938 5.1781 6.8446 9.7482 13.941 14.263 20.594 4.324 6.734 6.7994 14.572 10.83 21.688 1.192 2.1023 3.0563 3.4189 4.1562 5.375 9.0863 2.9243 11.891 1.7205 16.625-5.4062 0.362-14.783-7.3795-31.402-9.3125-50.156-1.2274-10.367-3.1456-19.472-4.3125-27.938-0.20887-11.874-3.267-19.981-5-30.812-0.918-5.314-3.398-14.044-2.875-21.5 0.567-8.118 5.351-21.686 13.625-20.781 4.803 0.526 6.009 5.2872 7.1174 9.3514 3.599 14.671 4.8939 27.899 7.9139 41.524 2.8767 11.755 4.8374 20.948 8.5938 28.656 1.987 4.551 5.2518 11.769 6.4688 19.375 2.0606 12.892 2.1181 25.7 7.875 37.938 0.004 0.009-0.004 0.0226 0 0.0312h0.1875c6.0305 4.5999 10.519 3.3961 12.719-2.1562 4.759-16.692-2.0885-41.966 3.5625-60.188 2.2701-11.357-0.80138-43.253-1.4375-65.938-0.26546-9.4663-1.1262-18.122 3.5938-25.062 12.967-8.424 19.108 7.4128 20.781 19.344 1.974 14.08 0.81525 30.2 2.1562 46.562 0.339 4.108 1.6302 8.2215 2.1562 12.188 0.573 4.313 1.522 7.9995 2.125 12.188 2.9867 20.715-3.1271 42.028 0.6875 60 6.5388 24.952 23.743-22.153 26.562-29.906 5.219-12.997 11.593-26.931 16.469-39.406 1.469-3.844 2.6248-7.6298 3.5938-11.469 2.8923-12.511 8.8459-35.173 19.344-39.406 8.092-0.758 11.395 3.1538 10.031 16.469-1.543 14.897-7.9702 31.998-10.781 48-1.0999 10.395-4.4316 19.755-7.1562 29.375-4.198 12.434-13.396 28.433-15.062 43-1.1686 27.23 0.97779 54.387 8.4062 75.562 7.8574 4.3914 13.184-1.8571 18.125-6.4688 3.185-2.94 5.8708-6.4565 8.5938-9.3125 6.367-6.681 12.485-11.41 17.094-17.906 4.1315-8.2934 10.768-13.988 18.031-18.625 7.211-4.657 12.308-7.127 20.781-7.875 6.6039-1.8383 11.742 0.8728 18.625 2.125 1.872 1.525 3.3758 2.0725 3.5938 4.3125 0.5 5.127-4.7832 6.0317-10.031 9.0357-18.749 12.648-36.516 28.751-48.031 46.839-2.078 12.971-7.6342 22.472-15.031 30.125-1.521 2.229-9.1468 8.717-10.969 10-9.633 15.924-13.071 23.526-22 40.156-20.587 12.661-21.009 51.245-11.281 75.656 1.017 9.016 5.303 17.38 9.125 22.938 1.6772-0.0166 1.6044-0.0816 4.0694-0.0893-1.1148-4.9983-8.0166-19.21-8.3819-25.004-1.901-18.222-10.225-38.084-2.125-55.607 2.536-5.095 9.184-10.12 12.875-15.031 6.5238-11.81 15.457-26.08 19.375-37.268 6.121-9.845 17.569-14.621 22.906-25.094 2.111-4.142 1.8648-9.0288 3.5938-13.594 4.3874-8.0897 11.818-18.59 17.906-25.094 13.8-12.226 29.902-23.148 43-33.656-0.514-12.861-12.463-14.285-24.344-15.781-11.793 0.95887-19.991 4.576-29.375 10.75-8.335 5.464-11.206 11.972-17.219 20.062-7.361 9.904-18.129 17.421-26.626 27.299-3.201 0.381-3.2397 1.2434-7.5447 0.52237-5.6205-23.837-7.8823-36.767-8.1102-62.508 0.34-3.3119 0.7615-8.9524 1.0848-12.174 9.9765-24.711 16.995-41.713 21.134-65.201 6.8033-16.252 21.594-67.025 0.71875-70.938-10.983-0.51417-18.276 11.075-22.219 19.344-5.169 11.194-5.5672 25.369-10.031 37.25-1.171 3.119-3.0938 5.3818-4.4688 8.5938-4.5822 9.475-26.072 67.599-29.406 61.25-4.918-11.713 0.79082-37.304-0.53125-55.5-0.407-5.603-2.0008-11.55-2.8438-17.219-3.141-21.142-3.6445-67.742-6.935-71.705-3.2438-5.1039-7.3808-13.963-15.69-14.014z"
                                         />
                                     </g>
                                 </svg>
                             </div>
                         </div>
                         
                         <div class="palm-status" id="palm-status">📷 Click "Start Camera" to begin</div>
                         
                         <div class="palm-controls">
                             <button id="palm-start-btn" class="phone-btn phone-btn-primary" onclick="if(window.palmAuthWrapper) window.palmAuthWrapper.startPalmCamera()">
                                 Start Camera
                             </button>
                            <button id="palm-capture-btn" class="phone-btn phone-btn-primary" onclick="if(window.palmAuthWrapper) window.palmAuthWrapper.capturePalmImage()" disabled>
                                Verify Palm
                            </button>
                             <button id="palm-stop-btn" class="phone-btn phone-btn-secondary" onclick="if(window.palmAuthWrapper) window.palmAuthWrapper.stopPalmCamera()" disabled>
                                 Stop Camera
                             </button>
                         </div>
                         
                         <div id="palm-scan-result" style="display: none;">
                             <div class="scan-result-icon">✓</div>
                             <p class="scan-result-text">Palm image captured successfully!</p>
                         </div>
                     </div>
                 </div>
                 
                 <div class="phone-modal-footer">
                     <p>Your palm data is encrypted and secure</p>
                 </div>
             </div>
         `;
         
         document.body.appendChild(modal);
         
         // Add palm scanning specific styles
         this.addPalmScanningStyles();
     }
     
     addPalmScanningStyles() {
         if (document.getElementById('palm-scanning-styles')) return;
         
         const style = document.createElement('style');
         style.id = 'palm-scanning-styles';
         style.textContent = `
              .palm-camera-container {
                  position: relative;
                  width: 100%;
                  aspect-ratio: 16/9;
                  border-radius: 12px;
                  overflow: hidden;
                  background: #000;
                  margin-bottom: 20px;
                  min-height: 200px;
                  max-height: 300px;
                  flex-shrink: 0;
              }
             
             #palm-video {
                 position: absolute;
                 inset: 0;
                 width: 100%;
                 height: 100%;
                 object-fit: contain;
                 transform: scaleX(-1);
             }
             
             .palm-hand-guide {
                 position: absolute;
                 inset: 0;
                 pointer-events: none;
                 z-index: 10;
             }
             
             .palm-svg {
                 position: absolute;
                 inset: 0;
                 width: 100%;
                 height: 100%;
                 transform: none;
                 overflow: visible;
             }
             
             .palm-outline {
                 fill: none;
                 stroke: rgba(0,255,0,.8);
                 stroke-width: 3;
                 stroke-dasharray: 8 4;
                 filter: url(#palm-glow);
                 transition: stroke .12s ease, stroke-width .12s ease, filter .12s ease;
             }
             
             .palm-outline.good {
                 stroke: #00fff2;
                 stroke-width: 5;
                 stroke-dasharray: none;
                 stroke-linecap: round;
                 stroke-linejoin: round;
                 filter: drop-shadow(0 0 6px rgba(0,255,242,.35));
             }
             
             .palm-camera-container.good #palm-video {
                 filter: brightness(.55) contrast(1.25) saturate(1.1);
             }
             
             .finger-dot {
                 fill: #00e5ff;
                 stroke: #fff;
                 stroke-width: 1;
             }
             
             .palm-placeholder {
                 position: absolute;
                 inset: 0;
                 display: flex;
                 flex-direction: column;
                 align-items: center;
                 justify-content: center;
                 color: #6c757d;
                 background: #f8f9fa;
             }
             
             .palm-icon {
                 font-size: 48px;
                 margin-bottom: 12px;
                 opacity: 0.7;
             }
             
              .palm-status {
                  margin-bottom: 16px;
                  padding: 10px;
                  border-radius: 8px;
                  font-weight: 700;
                  text-align: center;
                  background: rgba(76,175,80,.16);
                  border: 1px solid #4CAF50;
                  color: #4CAF50;
                  min-height: 48px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
              }
             
             .palm-status.error {
                 background: rgba(244,67,54,.16);
                 border: 1px solid #f44336;
                 color: #f44336;
             }
             
             .palm-controls {
                 display: flex;
                 gap: 8px;
                 justify-content: center;
                 margin-bottom: 16px;
                 flex-wrap: wrap;
             }
             
             .palm-controls .phone-btn {
                 flex: 1;
                 min-width: 120px;
                 max-width: 150px;
             }
             
             .scan-result-icon {
                 font-size: 48px;
                 color: #28a745;
                 text-align: center;
                 margin-bottom: 12px;
             }
             
             .scan-result-text {
                 text-align: center;
                 color: #28a745;
                 font-weight: 600;
                 margin: 0;
             }
         `;
         
         document.head.appendChild(style);
     }
     
     // Palm Camera Methods
     async startPalmCamera() {
         try {
             const statusEl = document.getElementById('palm-status');
             const startBtn = document.getElementById('palm-start-btn');
             const captureBtn = document.getElementById('palm-capture-btn');
             const stopBtn = document.getElementById('palm-stop-btn');
             const video = document.getElementById('palm-video');
             const placeholder = document.getElementById('palm-placeholder');
             const handGuide = document.getElementById('palm-hand-guide');
             
             statusEl.textContent = '🔄 Starting camera...';
             statusEl.className = 'palm-status';
             
             this.palmStream = await navigator.mediaDevices.getUserMedia({
                 video: { width: {ideal: 1280}, height: {ideal: 720}, facingMode: 'user' }
             });
             
             video.srcObject = this.palmStream;
             video.onloadedmetadata = () => {
                 statusEl.textContent = '📷 Position your palm over the outline';
                 statusEl.className = 'palm-status';
                 startBtn.disabled = true;
                 captureBtn.disabled = false;
                 stopBtn.disabled = false;
                 
                 // Show video and hide placeholder
                 video.style.display = 'block';
                 placeholder.style.display = 'none';
                 handGuide.style.display = 'block';
                 
                 // Set up MediaPipe hands detection
                 this.installPalmHands();
                 this.startPalmHighlightLoop();
                 this.positionPalmTargets();
             };
             
         } catch (error) {
             console.error('Camera error:', error);
             const statusEl = document.getElementById('palm-status');
             statusEl.textContent = '❌ Camera access denied or not available';
             statusEl.className = 'palm-status error';
         }
     }
     
     stopPalmCamera() {
         if (this.palmStream) {
             this.palmStream.getTracks().forEach(track => track.stop());
             this.palmStream = null;
         }
         
         this.stopPalmHighlightLoop();
         this.stopPalmCountdown();
         
         // Clear cooldown timeout if camera is stopped
         if (this.palmCountdownCooldownTimeout) {
             clearTimeout(this.palmCountdownCooldownTimeout);
             this.palmCountdownCooldownTimeout = null;
         }
         this.palmCountdownCooldown = false;
         
         const video = document.getElementById('palm-video');
         const placeholder = document.getElementById('palm-placeholder');
         const handGuide = document.getElementById('palm-hand-guide');
         const statusEl = document.getElementById('palm-status');
         const startBtn = document.getElementById('palm-start-btn');
         const captureBtn = document.getElementById('palm-capture-btn');
         const stopBtn = document.getElementById('palm-stop-btn');
         
         if (video) video.srcObject = null;
         if (video) video.style.display = 'none';
         if (placeholder) placeholder.style.display = 'flex';
         if (handGuide) handGuide.style.display = 'none';
         
         statusEl.textContent = '📷 Camera stopped';
         statusEl.className = 'palm-status';
         startBtn.disabled = false;
         captureBtn.disabled = true;
         stopBtn.disabled = true;
     }
     
    async capturePalmImage() {
        if (!this.palmStream) {
            const statusEl = document.getElementById('palm-status');
            statusEl.textContent = '❌ Camera not started';
            statusEl.className = 'palm-status error';
            return;
        }
        
        // Prevent multiple captures
        if (this.authenticationCompleted) {
            return;
        }
        
        // Check if we have a verified phone number from phone verification step
        if (!this.verifiedUser || !this.verifiedUser.phoneNumber) {
            const statusEl = document.getElementById('palm-status');
            statusEl.textContent = '❌ Phone verification required first';
            statusEl.className = 'palm-status error';
            return;
        }
        
        // Stop countdown if it's running
        this.stopPalmCountdown();
        
        const video = document.getElementById('palm-video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Mirror the image
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        
        // Show capturing message
        const statusEl = document.getElementById('palm-status');
        statusEl.textContent = '📸 Capturing and verifying palm...';
        statusEl.className = 'palm-status';
        
        // Disable capture button during processing
        const captureBtn = document.getElementById('palm-capture-btn');
        if (captureBtn) captureBtn.disabled = true;
        
        canvas.toBlob(async (blob) => {
            try {
                console.log('📸 Palm image captured, sending for recognition...');
                console.log('📱 Phone number:', this.verifiedUser.phoneNumber);
                
                // Create FormData for file upload
                const formData = new FormData();
                formData.append('image', blob, 'palm.jpg');
                formData.append('phoneNumber', this.verifiedUser.phoneNumber);
                formData.append('threshold', this.options.palmRecognitionThreshold.toString());
                
                // Send to backend for recognition
                statusEl.textContent = '🔍 Verifying palm...';
                statusEl.className = 'palm-status';
                
                console.log('🎯 Using threshold:', this.options.palmRecognitionThreshold);
                
                const response = await fetch(`${this.getApiBaseUrl()}/palm/recognize`, {
                    method: 'POST',
                    body: formData
                });
                
                console.log('API Response status:', response.status);
                
                const result = await response.json();
                console.log('Palm recognition result:', result);
                
                if (result.success && result.match) {
                    // Palm recognized successfully!
                    console.log('✅ Palm recognized!');
                    console.log('📱 Matched phone:', result.data.phoneNumber);
                    console.log('🎯 Confidence:', result.data.confidence);
                    
                    statusEl.textContent = '✅ Palm verified successfully!';
                    statusEl.className = 'palm-status';
                    
                    // Show result
                    const scanResult = document.getElementById('palm-scan-result');
                    if (scanResult) {
                        scanResult.style.display = 'block';
                    }
                    
                    // Mark authentication as completed
                    this.authenticationCompleted = true;
                    this.palmVerified = true;
                    
                    // Complete authentication after a short delay
                    setTimeout(() => {
                        this.closePalmScanningModal();
                        this.unlock();
                    }, 2000);
                    
                } else if (result.success && !result.match) {
                    // Palm not recognized
                    console.log('❌ Palm not recognized');
                    statusEl.textContent = '❌ Palm not recognized. Please register your palm first.';
                    statusEl.className = 'palm-status error';
                    
                    // Re-enable capture button
                    if (captureBtn) captureBtn.disabled = false;
                    
                } else {
                    // Error occurred
                    console.error('❌ Palm recognition failed:', result.message);
                    statusEl.textContent = `❌ Verification failed: ${result.message}`;
                    statusEl.className = 'palm-status error';
                    
                    // Re-enable capture button
                    if (captureBtn) captureBtn.disabled = false;
                }
                
            } catch (error) {
                console.error('❌ Palm recognition error:', error);
                statusEl.textContent = '❌ Network error. Please try again.';
                statusEl.className = 'palm-status error';
                
                // Re-enable capture button
                if (captureBtn) captureBtn.disabled = false;
            }
            
        }, 'image/jpeg', 0.9);
    }
     
     installPalmHands() {
         if (typeof Hands === 'undefined') {
             console.warn('MediaPipe Hands not loaded');
             return;
         }
         
         this.palmHands = new Hands({
             locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
         });
         
         this.palmHands.setOptions({
             selfieMode: true,
             maxNumHands: 1,
             modelComplexity: 1,
             minDetectionConfidence: 0.6,
             minTrackingConfidence: 0.6
         });
         
         this.palmHands.onResults(result => {
             if (!result.multiHandLandmarks || result.multiHandLandmarks.length === 0) {
                 const palmOutline = document.querySelector('.palm-outline');
                 const cameraContainer = document.querySelector('.palm-camera-container');
                 if (palmOutline) palmOutline.classList.remove('good');
                 if (cameraContainer) cameraContainer.classList.remove('good');
                 this.stopPalmCountdown();
                 return;
             }
             
             this.drawPalmLiveTipDots(result.multiHandLandmarks);
             
             if (this.allPalmTipsClose(result.multiHandLandmarks)) {
                 const palmOutline = document.querySelector('.palm-outline');
                 const cameraContainer = document.querySelector('.palm-camera-container');
                 if (palmOutline) palmOutline.classList.add('good');
                 if (cameraContainer) cameraContainer.classList.add('good');
                 
                 // Start countdown if not already started and not in cooldown
                 if (!this.palmCountdownActive && !this.palmCountdownCooldown) {
                     this.startPalmCountdown();
                 }
                 
             } else {
                 const palmOutline = document.querySelector('.palm-outline');
                 const cameraContainer = document.querySelector('.palm-camera-container');
                 if (palmOutline) palmOutline.classList.remove('good');
                 if (cameraContainer) cameraContainer.classList.remove('good');
                 
                 // Stop countdown if hand moves away
                 this.stopPalmCountdown();
             }
         });
     }
     
     startPalmHighlightLoop() {
         if (!this.palmHands) return;
         
         const video = document.getElementById('palm-video');
         const tick = async () => {
             await this.palmHands.send({image: video});
             this.palmRafId = requestAnimationFrame(tick);
         };
         
         cancelAnimationFrame(this.palmRafId);
         this.palmRafId = requestAnimationFrame(tick);
     }
     
     stopPalmHighlightLoop() {
         cancelAnimationFrame(this.palmRafId);
         this.palmRafId = null;
     }
     
     startPalmCountdown() {
         if (this.palmCountdownActive || this.palmCountdownCooldown) return;
         
         this.palmCountdownActive = true;
         this.palmCountdownTime = 2; // 2 seconds
         
         const statusEl = document.getElementById('palm-status');
         if (statusEl) {
             statusEl.textContent = `📷 Hold steady! Capturing in ${this.palmCountdownTime}...`;
             statusEl.className = 'palm-status';
         }
         
         this.palmCountdownInterval = setInterval(() => {
             this.palmCountdownTime--;
             
             if (this.palmCountdownTime > 0) {
                 const statusEl = document.getElementById('palm-status');
                 if (statusEl) {
                     statusEl.textContent = `📷 Hold steady! Capturing in ${this.palmCountdownTime}...`;
                 }
             } else {
                 // Countdown finished - capture image
                 this.stopPalmCountdown();
                 this.startPalmCountdownCooldown(); // Start cooldown to prevent multiple captures
                 this.capturePalmImage();
             }
         }, 1000);
     }
     
     stopPalmCountdown() {
         if (!this.palmCountdownActive) return;
         
         this.palmCountdownActive = false;
         this.palmCountdownTime = 0;
         
         if (this.palmCountdownInterval) {
             clearInterval(this.palmCountdownInterval);
             this.palmCountdownInterval = null;
         }
         
         const statusEl = document.getElementById('palm-status');
         if (statusEl) {
             statusEl.textContent = '📷 Position your palm over the outline';
             statusEl.className = 'palm-status';
         }
     }
     
     startPalmCountdownCooldown() {
         this.palmCountdownCooldown = true;
         
         // Clear any existing cooldown timeout
         if (this.palmCountdownCooldownTimeout) {
             clearTimeout(this.palmCountdownCooldownTimeout);
         }
         
         // Set 3-second cooldown
         this.palmCountdownCooldownTimeout = setTimeout(() => {
             this.palmCountdownCooldown = false;
             this.palmCountdownCooldownTimeout = null;
         }, 3000);
     }
     
     drawPalmLiveTipDots(landmarks) {
         const lm = landmarks[0];
         if (!lm) return;
         
         const dots = this.ensurePalmDebugDots(6);
         const tipIds = [4, 8, 12, 16, 20, 0]; // thumb -> pinky, palm
         
         for (let i = 0; i < tipIds.length; i++) {
             const tip = lm[tipIds[i]];
             if (!tip) continue;
             
             const sp = this.lmToPalmScreenXY(tip);
             const vp = this.screenToPalmSvgXY(sp.x, sp.y);
             const dot = dots[i];
             
             dot.setAttribute('cx', vp.x);
             dot.setAttribute('cy', vp.y);
         }
     }
     
     ensurePalmDebugDots(n = 6) {
         const g = document.getElementById('palm-debug-dots');
         if (!g) return [];
         
         while (g.childElementCount < n) {
             const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
             c.setAttribute('r', '6');
             c.setAttribute('class', 'finger-dot');
             g.appendChild(c);
         }
         return g.children;
     }
     
     lmToPalmScreenXY(lm) {
         const video = document.getElementById('palm-video');
         const box = this.getPalmVideoContentRect();
         return { x: box.x + lm.x * box.width, y: box.y + lm.y * box.height };
     }
     
     screenToPalmSvgXY(x, y) {
         const palmSvg = document.querySelector('.palm-svg');
         const overlaySpace = document.getElementById('palm-flip-left');
         if (!palmSvg || !overlaySpace) return { x, y };
         
         const pt = palmSvg.createSVGPoint();
         pt.x = x;
         pt.y = y;
         return pt.matrixTransform(overlaySpace.getScreenCTM().inverse());
     }
     
     getPalmVideoContentRect() {
         const video = document.getElementById('palm-video');
         const r = video.getBoundingClientRect();
         const vw = video.videoWidth || 1280;
         const vh = video.videoHeight || 720;
         
         if (!vw || !vh) return { x: r.left, y: r.top, width: r.width, height: r.height };
         
         const elAR = r.width / r.height;
         const vidAR = vw / vh;
         
         if (vidAR > elAR) {
             const contentW = r.width;
             const contentH = r.width / vidAR;
             const y = r.top + (r.height - contentH) / 2;
             return { x: r.left, y, width: contentW, height: contentH };
         } else {
             const contentH = r.height;
             const contentW = r.height * vidAR;
             const x = r.left + (r.width - contentW) / 2;
             return { x, y: r.top, width: contentW, height: contentH };
         }
     }
     
     tipPalmDistancesPX(landmarks) {
         const lm = landmarks[0];
         if (!lm) return [];
         
         const dists = [];
         const tipIds = [4, 8, 12, 16, 20, 0];
         const targetEls = [
             document.getElementById('pt0'),
             document.getElementById('pt1'),
             document.getElementById('pt2'),
             document.getElementById('pt3'),
             document.getElementById('pt4'),
             document.getElementById('pt5')
         ];
         
         for (let i = 0; i < tipIds.length; i++) {
             const tip = lm[tipIds[i]];
             if (!tip) continue;
             
             const p1 = this.lmToPalmScreenXY(tip);
             const tEl = targetEls[i];
             if (!tEl) continue;
             
             const cx = +tEl.getAttribute('cx');
             const cy = +tEl.getAttribute('cy');
             const p2 = this.svgToPalmScreenXY(cx, cy);
             
             dists.push(Math.hypot(p1.x - p2.x, p1.y - p2.y));
         }
         return dists;
     }
     
     svgToPalmScreenXY(x, y) {
         const palmSvg = document.querySelector('.palm-svg');
         const overlaySpace = document.getElementById('palm-flip-left');
         if (!palmSvg || !overlaySpace) return { x, y };
         
         const pt = palmSvg.createSVGPoint();
         pt.x = x;
         pt.y = y;
         return pt.matrixTransform(overlaySpace.getScreenCTM());
     }
     
     allPalmTipsClose(landmarks) {
         const dists = this.tipPalmDistancesPX(landmarks);
         if (dists.length < 6) return false;
         
         const cameraContainer = document.querySelector('.palm-camera-container');
         const box = cameraContainer.getBoundingClientRect();
         const threshold = Math.min(box.width, box.height) * 0.10; // 10% threshold
         
         return dists.every(d => d <= threshold);
     }
     
     positionPalmTargets() {
         const palmOutline = document.querySelector('.palm-outline');
         if (!palmOutline) return;
         
         const L = palmOutline.getTotalLength();
         const N = 2400;
         const pts = new Array(N);
         
         for (let i = 0; i < N; i++) {
             const p = palmOutline.getPointAtLength((i / (N - 1)) * L);
             pts[i] = { x: p.x, y: p.y, i };
         }
         
         const k = 7;
         const ys = pts.map(p => p.y);
         const ysm = ys.slice();
         for (let i = 0; i < N; i++) {
             let s = 0, c = 0;
             for (let j = -k; j <= k; j++) {
                 const t = i + j;
                 if (t >= 0 && t < N) { s += ys[t]; c++; }
             }
             ysm[i] = s / c;
         }
         
         const box = palmOutline.getBBox();
         const topGate = box.y + box.height * 0.72;
         
         const cand = [];
         for (let i = 1; i < N - 1; i++) {
             if (ysm[i] < ysm[i - 1] && ysm[i] < ysm[i + 1] && ysm[i] < topGate) {
                 cand.push({ x: pts[i].x, y: pts[i].y, score: -ysm[i], i });
             }
         }
         
         cand.sort((a, b) => a.score - b.score);
         const minDx = box.width * 0.12;
         const picked = [];
         for (const c of cand) {
             if (picked.every(p => Math.abs(p.x - c.x) > minDx)) picked.push(c);
             if (picked.length === 5) break;
         }
         
         if (picked.length < 5) {
             const extra = cand.filter(c => !picked.includes(c));
             for (const c of extra) {
                 if (picked.every(p => Math.abs(p.x - c.x) > minDx * 0.6)) picked.push(c);
                 if (picked.length === 5) break;
             }
         }
         
         picked.sort((a, b) => a.x - b.x);
         
         const dy = 4;
         const targetEls = [
             document.getElementById('pt0'),
             document.getElementById('pt1'),
             document.getElementById('pt2'),
             document.getElementById('pt3'),
             document.getElementById('pt4')
         ];
         
         for (let i = 0; i < 5; i++) {
             const p = picked[4-i] || { x: box.x, y: box.y };
             if (targetEls[i]) {
                 targetEls[i].setAttribute('cx', p.x);
                 targetEls[i].setAttribute('cy', p.y + dy);
             }
         }
         
         const middle = targetEls[2];
         const midX = Number(middle?.getAttribute('cx')) || (box.x + box.width * 0.5);
         const palmY = box.y + box.height * 0.63;
         const palmTarget = document.getElementById('pt5');
         if (palmTarget) {
             palmTarget.setAttribute('cx', midX);
             palmTarget.setAttribute('cy', palmY);
         }
     }
     
     closePalmScanningModal() {
         const modal = document.getElementById('palm-scanning-modal');
         if (modal) {
             modal.remove();
         }
     }
     
     // Phone Verification Modal Methods
     showPhoneVerificationModal() {
         this.createPhoneModal();
         this.currentStep = 1;
         this.phoneNumber = '';
         this.verificationCode = '';
         this.updateStepIndicator(1);
         this.showPhoneStep();
     }
     
     createPhoneModal() {
         // Remove existing modal if any
         const existingModal = document.getElementById('phone-verification-modal');
         if (existingModal) {
             existingModal.remove();
         }
         
         const modal = document.createElement('div');
         modal.id = 'phone-verification-modal';
         modal.className = 'phone-modal-overlay';
         modal.innerHTML = `
             <div class="phone-modal-content">
                 <div class="phone-modal-header">
                     <button class="phone-modal-close" onclick="if(window.palmAuthWrapper) window.palmAuthWrapper.closePhoneModal()">&times;</button>
                     <h2>Phone Verification</h2>
                     <p>Verify your phone number to proceed with payment</p>
                 </div>
                 
                 <div class="phone-modal-body">
                     <!-- Step Indicator -->
                     <div class="phone-step-indicator">
                         <div class="phone-step" id="phone-step-1"></div>
                         <div class="phone-step" id="phone-step-2"></div>
                     </div>
 
                     <!-- Step 1: Phone Number Input -->
                     <div id="phone-input-step" class="verification-step">
                         <div class="phone-form-group">
                             <label for="phone-input">Phone Number</label>
                             <input 
                                 type="tel" 
                                 id="phone-input" 
                                 class="phone-form-input" 
                                 placeholder="(555) 123-4567"
                                 maxlength="14"
                             >
                             <span id="phone-error" class="phone-error-message" style="display: none;"></span>
                         </div>
                         
                         <button id="send-code-btn" class="phone-btn phone-btn-primary" onclick="if(window.palmAuthWrapper) window.palmAuthWrapper.sendVerificationCode()">
                             <span id="send-code-text">Send Verification Code</span>
                             <div id="send-code-spinner" class="phone-spinner" style="display: none;"></div>
                         </button>
                     </div>
 
                     <!-- Step 2: Verification Code Input -->
                     <div id="code-input-step" class="verification-step" style="display: none;">
                         <div class="phone-form-group">
                             <label for="code-input">Verification Code</label>
                             <input 
                                 type="text" 
                                 id="code-input" 
                                 class="phone-form-input" 
                                 placeholder="Enter 6-digit code"
                                 maxlength="6"
                             >
                             <span id="code-error" class="phone-error-message" style="display: none;"></span>
                             <span id="code-success" class="phone-success-message" style="display: none;"></span>
                         </div>
                         
                         <button id="verify-code-btn" class="phone-btn phone-btn-primary" onclick="if(window.palmAuthWrapper) window.palmAuthWrapper.verifyCode()">
                             <span id="verify-code-text">Verify Code</span>
                             <div id="verify-code-spinner" class="phone-spinner" style="display: none;"></div>
                         </button>
                         
                         <button id="resend-code-btn" class="phone-btn phone-btn-secondary" onclick="if(window.palmAuthWrapper) window.palmAuthWrapper.resendCode()">
                             Resend Code
                         </button>
                     </div>
                 </div>
                 
                 <div class="phone-modal-footer">
                     <p>We'll send you a verification code via SMS</p>
                 </div>
             </div>
         `;
         
         document.body.appendChild(modal);
         
         // Add event listeners
         this.setupPhoneModalEvents();
     }
     
     setupPhoneModalEvents() {
         // Format phone number as user types
         const phoneInput = document.getElementById('phone-input');
         if (phoneInput) {
             phoneInput.addEventListener('input', (e) => {
                 let value = e.target.value.replace(/\D/g, '');
                 if (value.length >= 6) {
                     value = value.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
                 } else if (value.length >= 3) {
                     value = value.replace(/(\d{3})(\d{0,3})/, '($1) $2');
                 }
                 e.target.value = value;
                 this.phoneNumber = value.replace(/\D/g, '');
             });
             
             phoneInput.addEventListener('keypress', (e) => {
                 if (e.key === 'Enter') {
                     this.sendVerificationCode();
                 }
             });
         }
         
         // Format verification code (numbers only)
         const codeInput = document.getElementById('code-input');
         if (codeInput) {
             codeInput.addEventListener('input', (e) => {
                 e.target.value = e.target.value.replace(/\D/g, '');
                 this.verificationCode = e.target.value;
             });
             
             codeInput.addEventListener('keypress', (e) => {
                 if (e.key === 'Enter') {
                     this.verifyCode();
                 }
             });
         }
         
         // Close modal when clicking outside
         const modal = document.getElementById('phone-verification-modal');
         if (modal) {
             modal.addEventListener('click', (e) => {
                 if (e.target === modal) {
                     this.closePhoneModal();
                 }
             });
         }
     }
     
     closePhoneModal() {
         const modal = document.getElementById('phone-verification-modal');
         if (modal) {
             modal.remove();
         }
         // Reset form
         this.phoneNumber = '';
         this.verificationCode = '';
         this.currentStep = 1;
     }
     
     showPhoneStep() {
         document.getElementById('phone-input-step').style.display = 'block';
         document.getElementById('code-input-step').style.display = 'none';
         document.getElementById('phone-input').focus();
     }
     
     showCodeStep() {
         document.getElementById('phone-input-step').style.display = 'none';
         document.getElementById('code-input-step').style.display = 'block';
         document.getElementById('code-input').focus();
     }
     
     updateStepIndicator(step) {
         const step1 = document.getElementById('phone-step-1');
         const step2 = document.getElementById('phone-step-2');
         
         if (step1) step1.classList.remove('active', 'completed');
         if (step2) step2.classList.remove('active', 'completed');
         
         if (step >= 1 && step1) {
             step1.classList.add(step > 1 ? 'completed' : 'active');
         }
         if (step >= 2 && step2) {
             step2.classList.add('active');
         }
     }
     
     validatePhoneNumber(phone) {
         const digits = phone.replace(/\D/g, '');
         return digits.length === 10;
     }
     
     showError(elementId, message) {
         const errorElement = document.getElementById(elementId);
         if (errorElement) {
             errorElement.textContent = message;
             errorElement.style.display = 'block';
             const inputElement = document.getElementById(elementId.replace('-error', '-input'));
             if (inputElement) {
                 inputElement.classList.add('error');
             }
         }
     }
     
     hideError(elementId) {
         const errorElement = document.getElementById(elementId);
         if (errorElement) {
             errorElement.style.display = 'none';
             const inputElement = document.getElementById(elementId.replace('-error', '-input'));
             if (inputElement) {
                 inputElement.classList.remove('error');
             }
         }
     }
     
     showSuccess(elementId, message) {
         const successElement = document.getElementById(elementId);
         if (successElement) {
             successElement.textContent = message;
             successElement.style.display = 'block';
         }
     }
     
     hideSuccess(elementId) {
         const successElement = document.getElementById(elementId);
         if (successElement) {
             successElement.style.display = 'none';
         }
     }
     
     async sendVerificationCode() {
         const phoneInput = document.getElementById('phone-input');
         const phone = phoneInput ? phoneInput.value : '';
         
         // Extract only digits from the phone number
         const phoneDigits = phone.replace(/\D/g, '');
         
         console.log('Original phone:', phone);
         console.log('Phone digits:', phoneDigits);
         
         // Validate phone number (must be exactly 10 digits)
         if (phoneDigits.length !== 10) {
             this.showError('phone-error', 'Please enter a valid 10-digit phone number');
             return;
         }
         
         this.hideError('phone-error');
         
         // Show loading state
         const sendBtn = document.getElementById('send-code-btn');
         const sendText = document.getElementById('send-code-text');
         const sendSpinner = document.getElementById('send-code-spinner');
         
         if (sendBtn) sendBtn.disabled = true;
         if (sendText) sendText.style.display = 'none';
         if (sendSpinner) sendSpinner.style.display = 'block';
         
         try {
             // Call real API to send verification code with digits only
             const response = await fetch(`${this.getApiBaseUrl()}/auth/send-code`, {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                 },
                 body: JSON.stringify({
                     phoneNumber: phoneDigits
                 })
             });
             
             console.log('API Response status:', response.status);
             
             const data = await response.json();
             console.log('API Response data:', data);
             
             if (data.success) {
                 // Move to next step
                 this.currentStep = 2;
                 this.updateStepIndicator(2);
                 this.showCodeStep();
                 
                 console.log('Verification code sent to:', phoneDigits);
                 
             } else {
                 this.showError('phone-error', data.message || 'Failed to send verification code');
             }
             
         } catch (error) {
             console.error('Error sending verification code:', error);
             this.showError('phone-error', 'Network error. Please check your connection and try again.');
         } finally {
             // Reset button state
             if (sendBtn) sendBtn.disabled = false;
             if (sendText) sendText.style.display = 'block';
             if (sendSpinner) sendSpinner.style.display = 'none';
         }
     }
     
     async verifyCode() {
         const codeInput = document.getElementById('code-input');
         const phoneInput = document.getElementById('phone-input');
         const code = codeInput ? codeInput.value : '';
         const phone = phoneInput ? phoneInput.value : '';
         
         // Extract only digits from the phone number
         const phoneDigits = phone.replace(/\D/g, '');
         
         // Validate code
         if (code.length !== 6) {
             this.showError('code-error', 'Please enter the 6-digit verification code');
             return;
         }
         
         this.hideError('code-error');
         
         // Show loading state
         const verifyBtn = document.getElementById('verify-code-btn');
         const verifyText = document.getElementById('verify-code-text');
         const verifySpinner = document.getElementById('verify-code-spinner');
         
         if (verifyBtn) verifyBtn.disabled = true;
         if (verifyText) verifyText.style.display = 'none';
         if (verifySpinner) verifySpinner.style.display = 'block';
         
         try {
             // Call real API to verify code with digits only
             const response = await fetch(`${this.getApiBaseUrl()}/auth/verify-code`, {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                 },
                 body: JSON.stringify({
                     phoneNumber: phoneDigits,
                     code: code
                 })
             });
             
             console.log('Verify API Response status:', response.status);
             
             const data = await response.json();
             console.log('Verify API Response data:', data);
             
             if (data.success) {
                 this.showSuccess('code-success', '✓ Phone number verified successfully!');
                 
                 // Store user data and token for future use
                 this.verifiedUser = data.data.user;
                 this.authToken = data.data.token;
                 
                 // Close modal and proceed to palm scanning after a short delay
                 setTimeout(() => {
                     this.onPhoneVerificationSuccess();
                 }, 1500);
                 
             } else {
                 this.showError('code-error', data.message || 'Invalid verification code. Please try again.');
             }
             
         } catch (error) {
             console.error('Error verifying code:', error);
             this.showError('code-error', 'Network error. Please check your connection and try again.');
         } finally {
             // Reset button state
             if (verifyBtn) verifyBtn.disabled = false;
             if (verifyText) verifyText.style.display = 'block';
             if (verifySpinner) verifySpinner.style.display = 'none';
         }
     }
     
     async resendCode() {
         const resendBtn = document.getElementById('resend-code-btn');
         const phoneInput = document.getElementById('phone-input');
         const phone = phoneInput ? phoneInput.value : '';
         
         // Extract only digits from the phone number
         const phoneDigits = phone.replace(/\D/g, '');
         
         if (resendBtn) {
             resendBtn.disabled = true;
             resendBtn.textContent = 'Sending...';
         }
         
         try {
             // Call real API to resend code with digits only
             const response = await fetch(`${this.getApiBaseUrl()}/auth/resend-code`, {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                 },
                 body: JSON.stringify({
                     phoneNumber: phoneDigits
                 })
             });
             
             console.log('Resend API Response status:', response.status);
             
             const data = await response.json();
             console.log('Resend API Response data:', data);
             
             if (data.success) {
                 if (resendBtn) {
                     resendBtn.textContent = 'Code sent!';
                     
                     setTimeout(() => {
                         if (resendBtn) {
                             resendBtn.disabled = false;
                             resendBtn.textContent = 'Resend Code';
                         }
                     }, 2000);
                 }
                 
                 // Clear any existing error messages
                 this.hideError('code-error');
                 
             } else {
                 if (resendBtn) {
                     resendBtn.disabled = false;
                     resendBtn.textContent = 'Resend Code';
                 }
                 this.showError('code-error', data.message || 'Failed to resend code. Please try again.');
             }
             
         } catch (error) {
             console.error('Error resending code:', error);
             if (resendBtn) {
                 resendBtn.disabled = false;
                 resendBtn.textContent = 'Resend Code';
             }
             this.showError('code-error', 'Network error. Please check your connection and try again.');
         }
     }
    
    handleAuthentication() {
        // This is where you would integrate with your palm recognition system
        // For now, we'll simulate the authentication process
        
        const authButton = document.getElementById('palm-auth-btn');
        if (authButton) {
            authButton.disabled = true;
            authButton.textContent = 'Authenticating...';
        }
        
        // Simulate authentication delay
        setTimeout(() => {
            // In a real implementation, this would call your palm recognition API
            this.simulatePalmAuthentication();
        }, 2000);
    }
    
    simulatePalmAuthentication() {
        // Simulate successful authentication
        // In real implementation, replace this with actual palm recognition call
        
        const authButton = document.getElementById('palm-auth-btn');
        if (authButton) {
            authButton.textContent = '✓ Authenticated';
            authButton.style.background = '#28a745';
        }
        
        setTimeout(() => {
            this.unlock();
        }, 1000);
    }
    
    // Public methods for external control
    forceLock() {
        this.lock();
    }
    
    forceUnlock() {
        this.unlock();
    }
    
    isPaymentLocked() {
        return this.isLocked;
    }
    
    // Event system
    triggerEvent(eventName, data = {}) {
        const event = new CustomEvent(eventName, {
            detail: { wrapper: this, ...data }
        });
        document.dispatchEvent(event);
    }
    
    // Method to integrate with actual palm recognition
    authenticateWithPalm(palmData) {
        // This method should be called with actual palm recognition data
        // For example: wrapper.authenticateWithPalm(palmImageData)
        
        return new Promise((resolve, reject) => {
            // Simulate API call to your palm recognition service
            setTimeout(() => {
                // In real implementation, send palmData to your backend
                const isAuthenticated = Math.random() > 0.3; // 70% success rate for demo
                
                if (isAuthenticated) {
                    this.unlock();
                    resolve({ success: true, message: 'Palm authentication successful' });
                } else {
                    this.showStatus('Palm authentication failed. Please try again.', 'error');
                    reject({ success: false, message: 'Palm authentication failed' });
                }
            }, 1500);
        });
    }
}

// Auto-initialize when script loads
let palmAuthWrapper;

 // Initialize wrapper when DOM is ready
 function initPalmAuthWrapper() {
     palmAuthWrapper = new PalmAuthWrapper({
         // You can customize options here
         lockMessage: 'Complete two-step authentication to proceed with payment',
         unlockMessage: 'Authentication complete! You may now complete your payment.',
         apiBaseUrl: 'http://localhost:5000/api' // Can be changed for different environments
     });
     
     // Make sure the wrapper is available globally
     if (typeof window !== 'undefined') {
         window.palmAuthWrapper = palmAuthWrapper;
         console.log('Palm Auth Wrapper assigned to window.palmAuthWrapper');
     }
 }

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PalmAuthWrapper;
} else if (typeof window !== 'undefined') {
    window.PalmAuthWrapper = PalmAuthWrapper;
}

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPalmAuthWrapper);
} else {
    initPalmAuthWrapper();
}
