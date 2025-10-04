"""
Simple test script for the trained hand keypoint detection model
Tests the model on sample images and visualizes the results
"""

import cv2
import numpy as np
from ultralytics import YOLO
import matplotlib.pyplot as plt
from pathlib import Path
import os

def test_model_on_image(model_path="./modal_training_results/best.pt", image_path="./modal_training_results/IMG_00000026.jpg", save_result=True):
    """
    Test the trained model on a single image
    
    Args:
        model_path: Path to the trained model (.pt file)
        image_path: Path to the test image
        save_result: Whether to save the result image
    """
    
    print(f"🔍 Testing model: {model_path}")
    print(f"📷 Image: {image_path}")
    
    # Load the trained model
    try:
        model = YOLO(model_path)
        print("✅ Model loaded successfully")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return None
    
    # Load and preprocess image
    try:
        image = cv2.imread(str(image_path))
        if image is None:
            print(f"❌ Could not load image: {image_path}")
            return None
        
        # Convert BGR to RGB for display
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        print(f"✅ Image loaded: {image.shape}")
    except Exception as e:
        print(f"❌ Failed to load image: {e}")
        return None
    
    # Run inference
    try:
        print("🚀 Running inference...")
        results = model(image)
        
        if len(results) == 0:
            print("❌ No results returned")
            return None
        
        result = results[0]
        print("✅ Inference completed")
        
        # Check if keypoints were detected
        if result.keypoints is None or len(result.keypoints) == 0:
            print("❌ No hand keypoints detected")
            return None
        
        keypoints = result.keypoints.xy[0].cpu().numpy()  # Shape: (21, 2)
        confidences = result.keypoints.conf[0].cpu().numpy()  # Shape: (21,)
        
        print(f"✅ Detected {len(keypoints)} keypoints")
        print(f"   Average confidence: {np.mean(confidences):.3f}")
        print(f"   Min confidence: {np.min(confidences):.3f}")
        print(f"   Max confidence: {np.max(confidences):.3f}")
        
        # Visualize results
        result_image = visualize_keypoints(image_rgb, keypoints, confidences)
        
        if save_result:
            output_path = f"test_result_{Path(image_path).stem}.jpg"
            cv2.imwrite(output_path, cv2.cvtColor(result_image, cv2.COLOR_RGB2BGR))
            print(f"💾 Result saved to: {output_path}")
        
        return {
            'keypoints': keypoints,
            'confidences': confidences,
            'result_image': result_image,
            'success': True
        }
        
    except Exception as e:
        print(f"❌ Inference failed: {e}")
        return None

def visualize_keypoints(image, keypoints, confidences, threshold=0.5):
    """
    Visualize hand keypoints on the image
    
    Args:
        image: Input image (RGB)
        keypoints: Array of keypoint coordinates (21, 2)
        confidences: Array of keypoint confidences (21,)
        threshold: Confidence threshold for displaying keypoints
    """
    
    # Create a copy of the image
    result_image = image.copy()
    
    # Define hand keypoint connections (MediaPipe hand landmarks)
    connections = [
        # Thumb
        (0, 1), (1, 2), (2, 3), (3, 4),
        # Index finger
        (0, 5), (5, 6), (6, 7), (7, 8),
        # Middle finger
        (0, 9), (9, 10), (10, 11), (11, 12),
        # Ring finger
        (0, 13), (13, 14), (14, 15), (15, 16),
        # Pinky
        (0, 17), (17, 18), (18, 19), (19, 20)
    ]
    
    # Draw connections
    for start_idx, end_idx in connections:
        if (confidences[start_idx] > threshold and 
            confidences[end_idx] > threshold):
            
            start_point = tuple(keypoints[start_idx].astype(int))
            end_point = tuple(keypoints[end_idx].astype(int))
            
            cv2.line(result_image, start_point, end_point, (0, 255, 0), 2)
    
    # Draw keypoints
    for i, (kp, conf) in enumerate(zip(keypoints, confidences)):
        if conf > threshold:
            point = tuple(kp.astype(int))
            # Color code by confidence
            color_intensity = int(255 * conf)
            color = (color_intensity, 0, 255 - color_intensity)  # Red to blue
            
            cv2.circle(result_image, point, 4, color, -1)
            cv2.circle(result_image, point, 6, (255, 255, 255), 1)
            
            # Add keypoint number
            cv2.putText(result_image, str(i), 
                       (point[0] + 8, point[1] - 8), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
    
    return result_image

def test_model_on_dataset(model_path="./modal_training_results/best.pt", dataset_path="hand_keypoint_subset", num_samples=5):
    """
    Test the model on multiple images from the dataset
    
    Args:
        model_path: Path to the trained model
        dataset_path: Path to the dataset directory
        num_samples: Number of test images to use
    """
    
    print(f"🧪 Testing model on {num_samples} samples from dataset...")
    
    # Find test images
    dataset_path = Path(dataset_path)
    train_images = list((dataset_path / "images" / "train").glob("*.jpg"))
    val_images = list((dataset_path / "images" / "val").glob("*.jpg"))
    
    if len(train_images) == 0 and len(val_images) == 0:
        print("❌ No images found in dataset")
        return
    
    # Use validation images for testing
    test_images = val_images[:num_samples] if val_images else train_images[:num_samples]
    
    print(f"📊 Found {len(test_images)} test images")
    
    results = []
    for i, image_path in enumerate(test_images):
        print(f"\n--- Test {i+1}/{len(test_images)} ---")
        result = test_model_on_image(model_path, image_path, save_result=True)
        if result:
            results.append(result)
    
    # Summary
    if results:
        avg_confidences = [np.mean(r['confidences']) for r in results]
        print(f"\n📈 Test Summary:")
        print(f"   Successful detections: {len(results)}/{len(test_images)}")
        print(f"   Average confidence: {np.mean(avg_confidences):.3f}")
        print(f"   Min confidence: {np.min(avg_confidences):.3f}")
        print(f"   Max confidence: {np.max(avg_confidences):.3f}")
    else:
        print("❌ No successful detections")

def find_trained_model():
    """Find the trained model file"""
    
    # Look for model files in common locations
    possible_paths = [
        "./modal_training_results/best.pt",
        "./modal_training_results/last.pt",
        "./modal_training_results/weights/best.pt",
        "./modal_training_results/weights/last.pt",
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    
    return None

def main():
    """Main test function"""
    
    print("🤖 Hand Keypoint Model Tester")
    print("=" * 40)
    
    # Find the trained model
    model_path = find_trained_model()
    
    if not model_path:
        print("❌ No trained model found!")
        print("   Please train a model first or specify the model path manually")
        print("\n   Expected locations:")
        print("   - modal_training_results/weights/best.pt")
        print("   - runs/pose/train/weights/best.pt")
        return
    
    print(f"✅ Found model: {model_path}")
    
    # Test on dataset if available
    dataset_path = "hand_keypoint_subset"
    if os.path.exists(dataset_path):
        print(f"\n🧪 Testing on dataset: {dataset_path}")
        test_model_on_dataset(model_path, dataset_path, num_samples=3)
    else:
        print(f"\n⚠️  Dataset not found at: {dataset_path}")
        print("   Please provide a test image manually")
    
    print("\n🎉 Testing completed!")
    print("   Check the generated test_result_*.jpg files for visualization")

if __name__ == "__main__":
    main()
