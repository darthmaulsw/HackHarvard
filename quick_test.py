"""
Quick test script for hand keypoint model
Simple and fast testing without heavy dependencies
"""

import cv2
import numpy as np
from ultralytics import YOLO
from pathlib import Path
import os

def quick_test(model_path, image_path):
    """Quick test of the model on a single image"""
    
    print(f"🔍 Testing: {Path(model_path).name}")
    print(f"📷 Image: {Path(image_path).name}")
    
    # Load model
    try:
        model = YOLO(model_path)
        print("✅ Model loaded")
    except Exception as e:
        print(f"❌ Model load failed: {e}")
        return False
    
    # Load image
    try:
        image = cv2.imread(str(image_path))
        if image is None:
            print(f"❌ Image load failed")
            return False
        print(f"✅ Image loaded: {image.shape}")
    except Exception as e:
        print(f"❌ Image load failed: {e}")
        return False
    
    # Run inference
    try:
        results = model(image)
        result = results[0]
        
        if result.keypoints is None or len(result.keypoints) == 0:
            print("❌ No keypoints detected")
            return False
        
        keypoints = result.keypoints.xy[0].cpu().numpy()
        confidences = result.keypoints.conf[0].cpu().numpy()
        
        print(f"✅ Detected {len(keypoints)} keypoints")
        print(f"   Avg confidence: {np.mean(confidences):.3f}")
        print(f"   Min confidence: {np.min(confidences):.3f}")
        print(f"   Max confidence: {np.max(confidences):.3f}")
        
        # Simple visualization
        result_image = image.copy()
        
        # Draw keypoints
        for i, (kp, conf) in enumerate(zip(keypoints, confidences)):
            if conf > 0.5:  # Only show confident keypoints
                point = tuple(kp.astype(int))
                cv2.circle(result_image, point, 3, (0, 255, 0), -1)
                cv2.putText(result_image, str(i), 
                           (point[0] + 5, point[1] - 5), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.3, (255, 255, 255), 1)
        
        # Save result
        output_path = f"quick_test_result.jpg"
        cv2.imwrite(output_path, result_image)
        print(f"💾 Result saved: {output_path}")
        
        return True
        
    except Exception as e:
        print(f"❌ Inference failed: {e}")
        return False

def find_model():
    """Find the trained model"""
    paths = [
        "./modal_training_results/best.pt",
        "./modal_training_results/last.pt",
        "./modal_training_results/weights/best.pt",
        "./modal_training_results/weights/last.pt",
        "runs/pose/train/weights/best.pt",
        "runs/pose/train/weights/last.pt"
    ]
    
    for path in paths:
        if os.path.exists(path):
            return path
    return None

def find_test_image():
    """Find a test image"""
    # Look in dataset
    dataset_path = "hand_keypoint_subset"
    if os.path.exists(dataset_path):
        val_images = list(Path(dataset_path).glob("images/val/*.jpg"))
        if val_images:
            return str(val_images[0])
        
        train_images = list(Path(dataset_path).glob("images/train/*.jpg"))
        if train_images:
            return str(train_images[0])
    
    return None

def main():
    print("⚡ Quick Hand Keypoint Model Test")
    print("=" * 35)
    
    # Find model
    model_path = find_model()
    if not model_path:
        print("❌ No model found!")
        print("   Expected: modal_training_results/weights/best.pt")
        return
    
    print(f"✅ Model: {model_path}")
    
    # Find test image
    image_path = find_test_image()
    if not image_path:
        print("❌ No test image found!")
        print("   Please provide an image path manually")
        return
    
    print(f"✅ Test image: {image_path}")
    
    # Run test
    print("\n🚀 Running test...")
    success = quick_test(model_path, image_path)
    
    if success:
        print("\n🎉 Test passed! Model is working correctly.")
    else:
        print("\n❌ Test failed. Check the error messages above.")

if __name__ == "__main__":
    main()
