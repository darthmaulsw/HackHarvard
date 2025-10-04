

import cv2
import numpy as np
from palm_recognition_system import PalmRecognitionSystem
from pathlib import Path
import os

def capture_palm_image(camera_index=0, save_path="my_palm.jpg"):
    """
    Capture a palm image using the webcam
    
    Args:
        camera_index: Camera index (usually 0 for default camera)
        save_path: Path to save the captured image
    """
    print("📷 Capturing palm image...")
    print("   Place your palm flat in front of the camera")
    print("   Press SPACE to capture, ESC to cancel")
    
    cap = cv2.VideoCapture(camera_index)
    
    if not cap.isOpened():
        print("❌ Could not open camera")
        return None
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("❌ Failed to read from camera")
            break
        
        # Flip frame horizontally for mirror effect
        frame = cv2.flip(frame, 1)
        
        # Add instructions
        cv2.putText(frame, "Place your palm flat in front of camera", 
                   (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(frame, "Press SPACE to capture, ESC to cancel", 
                   (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        cv2.imshow('Palm Capture', frame)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord(' '):  # Space key
            # Save the captured image
            cv2.imwrite(save_path, frame)
            print(f"✅ Palm image saved to: {save_path}")
            break
        elif key == 27:  # ESC key
            print("❌ Capture cancelled")
            break
    
    cap.release()
    cv2.destroyAllWindows()
    
    return save_path if os.path.exists(save_path) else None

def test_palm_recognition():
    """Test the palm recognition system"""
    print("🤖 Testing Palm Recognition System")
    print("=" * 50)
    
    # Initialize the system
    system = PalmRecognitionSystem()
    
    if system.model is None:
        print("❌ Cannot proceed without a trained model")
        print("   Please ensure you have a trained model at: ./modal_training_results/best.pt")
        return
    
    print("✅ Palm recognition system initialized")
    
    # Check if we have any existing palm images to test with
    test_images = []
    
    # Look for existing test images
    possible_test_images = [
        "./modal_training_results/IMG_00000026.jpg",
        "my_palm.jpg",
        "test_palm.jpg"
    ]
    
    for img_path in possible_test_images:
        if os.path.exists(img_path):
            test_images.append(img_path)
    
    # If no test images found, offer to capture one
    if not test_images:
        print("\n📷 No test images found. Would you like to capture your palm?")
        print("   This will open your webcam to take a photo of your palm.")
        
        response = input("   Capture palm image? (y/n): ").lower().strip()
        if response == 'y':
            captured_image = capture_palm_image()
            if captured_image:
                test_images.append(captured_image)
        else:
            print("   Please place a palm image in the current directory and run again")
            return
    
    # Test with available images
    for i, image_path in enumerate(test_images):
        print(f"\n--- Test {i+1}: {Path(image_path).name} ---")
        
        # Visualize the palm analysis
        print("🔍 Analyzing palm...")
        vis_image = system.visualize_palm_analysis(image_path, f"analysis_{Path(image_path).stem}.jpg")
        
        if vis_image is not None:
            print("✅ Palm analysis completed")
            
            # Try to recognize the palm
            print("🔍 Attempting palm recognition...")
            result = system.recognize_palm(image_path, threshold=0.10)
            
            if result and result['match']:
                print(f"✅ Palm recognized as: {result['person_name']}")
                print(f"   Match confidence: {1 - result['distance']:.3f}")
            else:
                print("❌ Palm not recognized (not in database)")
                
                # Offer to register this palm
                if result:
                    print(f"   Best match distance: {result['distance']:.6f}")
                    print(f"   Threshold: {result['threshold']}")
                
                register = input("   Would you like to register this palm? (y/n): ").lower().strip()
                if register == 'y':
                    person_name = input("   Enter your name/ID: ").strip()
                    if person_name:
                        success = system.register_palm(image_path, person_name)
                        if success:
                            print(f"✅ Palm registered for: {person_name}")
                        else:
                            print("❌ Failed to register palm")
        else:
            print("❌ Failed to analyze palm")
    
    # Show database status
    print(f"\n📋 Database Status:")
    system.list_registered_palms()

def demo_with_sample_images():
    """Demo the system with sample images from the dataset"""
    print("🧪 Demo with Sample Images")
    print("=" * 30)
    
    system = PalmRecognitionSystem()
    
    if system.model is None:
        print("❌ Cannot proceed without a trained model")
        return
    
    # Look for sample images in the dataset
    dataset_path = Path("hand_keypoint_subset/images/val")
    if dataset_path.exists():
        sample_images = list(dataset_path.glob("*.jpg"))[:3]  # Take first 3 images
        
        if sample_images:
            print(f"📊 Found {len(sample_images)} sample images")
            
            for i, image_path in enumerate(sample_images):
                print(f"\n--- Sample {i+1}: {image_path.name} ---")
                
                # Create visualization
                vis_image = system.visualize_palm_analysis(
                    str(image_path), 
                    f"sample_analysis_{i+1}.jpg"
                )
                
                if vis_image is not None:
                    # Try recognition
                    result = system.recognize_palm(str(image_path))
                    
                    if result and result['match']:
                        print(f"✅ Recognized as: {result['person_name']}")
                    else:
                        print("❌ Not in database")
                        
                        # Register as sample
                        person_name = f"Sample_{i+1}"
                        system.register_palm(str(image_path), person_name)
                        print(f"✅ Registered as: {person_name}")
        else:
            print("❌ No sample images found in dataset")
    else:
        print("❌ Dataset not found")

def main():
    """Main function"""
    print("🤖 Palm Recognition System - Test Suite")
    print("=" * 50)
    
    print("\nChoose an option:")
    print("1. Test with your own palm (webcam capture)")
    print("2. Demo with sample images from dataset")
    print("3. Test with existing images")
    
    choice = input("\nEnter your choice (1-3): ").strip()
    
    if choice == "1":
        test_palm_recognition()
    elif choice == "2":
        demo_with_sample_images()
    elif choice == "3":
        test_palm_recognition()
    else:
        print("❌ Invalid choice")

if __name__ == "__main__":
    main()
