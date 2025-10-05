"""
Palm Recognition System using Hand Keypoint Detection
Measures distances between finger knuckles to create unique palm signatures
"""

import cv2
import numpy as np
import json
import hashlib
from pathlib import Path
from ultralytics import YOLO
import matplotlib.pyplot as plt
from typing import Dict, List, Tuple, Optional
import pickle
import os
import sys

class PalmRecognitionSystem:
    """
    Palm recognition system that uses hand keypoint detection to measure
    distances between finger knuckles and create unique palm signatures
    """
    
    def __init__(self, model_path: str = "./modal_training_results/best.pt"):
        """
        Initialize the palm recognition system
        
        Args:
            model_path: Path to the trained YOLO hand keypoint model
        """
        self.model_path = model_path
        self.model = None
        self.palm_database = {}  # Store palm signatures
        self.database_file = "palm_database.pkl"
        
        # MediaPipe hand landmark indices for knuckles
        self.knuckle_indices = {
            'wrist': 0,
            'index_knuckle': 5,    # Base of index finger
            'middle_knuckle': 9,   # Base of middle finger  
            'ring_knuckle': 13,    # Base of ring finger
            'pinky_knuckle': 17    # Base of pinky finger
        }
        
        # Load the trained model
        self.load_model()
        
        # Load existing palm database
        self.load_database()
    
    def load_model(self):
        """Load the trained YOLO model"""
        try:
            if os.path.exists(self.model_path):
                # Load model with verbose=False to suppress YOLO output
                self.model = YOLO(self.model_path, verbose=False)
                print(f"✅ Model loaded successfully from {self.model_path}", file=sys.stderr)
            else:
                print(f"❌ Model not found at {self.model_path}", file=sys.stderr)
                print("   Please train a model first or check the path", file=sys.stderr)
                self.model = None
        except Exception as e:
            print(f"❌ Failed to load model: {e}", file=sys.stderr)
            self.model = None
    
    def load_database(self):
        """Load existing palm database from file"""
        try:
            if os.path.exists(self.database_file):
                with open(self.database_file, 'rb') as f:
                    self.palm_database = pickle.load(f)
                print(f"✅ Loaded {len(self.palm_database)} palm signatures from database", file=sys.stderr)
            else:
                print("📝 Creating new palm database", file=sys.stderr)
                self.palm_database = {}
        except Exception as e:
            print(f"❌ Failed to load database: {e}", file=sys.stderr)
            self.palm_database = {}
    
    def save_database(self):
        """Save palm database to file"""
        try:
            with open(self.database_file, 'wb') as f:
                pickle.dump(self.palm_database, f)
            print(f"💾 Saved {len(self.palm_database)} palm signatures to database", file=sys.stderr)
        except Exception as e:
            print(f"❌ Failed to save database: {e}", file=sys.stderr)
    
    def detect_hand_keypoints(self, image_path: str) -> Optional[Tuple[np.ndarray, np.ndarray]]:
        """
        Detect hand keypoints in an image
        
        Args:
            image_path: Path to the input image
            
        Returns:
            Tuple of (keypoints, confidences) or None if detection fails
        """
        if self.model is None:
            print("❌ Model not loaded", file=sys.stderr)
            return None
        
        try:
            # Load image
            image = cv2.imread(str(image_path))
            if image is None:
                print(f"❌ Could not load image: {image_path}", file=sys.stderr)
                return None
            
            # Run inference with verbose=False to suppress output
            results = self.model(image, verbose=False)
            
            if len(results) == 0:
                print("❌ No results returned", file=sys.stderr)
                return None
            
            result = results[0]
            
            # Check if keypoints were detected
            if result.keypoints is None or len(result.keypoints) == 0:
                print("❌ No hand keypoints detected", file=sys.stderr)
                return None
            
            keypoints = result.keypoints.xy[0].cpu().numpy()  # Shape: (21, 2)
            confidences = result.keypoints.conf[0].cpu().numpy()  # Shape: (21,)
            
            # Check if knuckle keypoints have sufficient confidence
            knuckle_confidences = [confidences[idx] for idx in self.knuckle_indices.values()]
            min_confidence = 0.5
            
            if min(knuckle_confidences) < min_confidence:
                print(f"❌ Low confidence in knuckle detection (min: {min(knuckle_confidences):.3f})", file=sys.stderr)
                return None
            
            print(f"✅ Detected {len(keypoints)} keypoints with avg confidence: {np.mean(confidences):.3f}", file=sys.stderr)
            return keypoints, confidences
            
        except Exception as e:
            print(f"❌ Keypoint detection failed: {e}", file=sys.stderr)
            return None
    
    def calculate_knuckle_distances(self, keypoints: np.ndarray) -> Dict[str, float]:
        """
        Calculate distances between knuckle points
        
        Args:
            keypoints: Array of keypoint coordinates (21, 2)
            
        Returns:
            Dictionary of distance measurements
        """
        distances = {}
        
        # Get knuckle coordinates
        knuckle_coords = {}
        for name, idx in self.knuckle_indices.items():
            knuckle_coords[name] = keypoints[idx]
        
        # Calculate all pairwise distances between knuckles
        knuckle_names = list(knuckle_coords.keys())
        
        for i, name1 in enumerate(knuckle_names):
            for j, name2 in enumerate(knuckle_names[i+1:], i+1):
                coord1 = knuckle_coords[name1]
                coord2 = knuckle_coords[name2]
                
                # Calculate Euclidean distance
                distance = np.sqrt(np.sum((coord1 - coord2) ** 2))
                
                # Create a consistent key name (alphabetically sorted)
                key = f"{min(name1, name2)}_{max(name1, name2)}"
                distances[key] = distance
        
        return distances
    
    def normalize_distances(self, distances: Dict[str, float]) -> Dict[str, float]:
        """
        Normalize distances to make them scale-invariant
        
        Args:
            distances: Dictionary of raw distances
            
        Returns:
            Dictionary of normalized distances
        """
        # Use wrist-to-middle_knuckle as reference distance for normalization
        reference_key = "middle_knuckle_wrist"
        if reference_key not in distances:
            # Fallback to any available distance
            reference_key = list(distances.keys())[0]
        
        reference_distance = distances[reference_key]
        
        normalized = {}
        for key, distance in distances.items():
            normalized[key] = distance / reference_distance
        
        return normalized
    
    def generate_palm_signature(self, distances: Dict[str, float]) -> str:
        """
        Generate a unique signature from knuckle distances
        
        Args:
            distances: Dictionary of normalized distances
            
        Returns:
            Unique signature string
        """
        # Sort distances by key for consistency
        sorted_distances = sorted(distances.items())
        
        # Create a string representation
        distance_string = "|".join([f"{key}:{value:.6f}" for key, value in sorted_distances])
        
        # Generate hash
        signature = hashlib.sha256(distance_string.encode()).hexdigest()[:16]
        
        return signature
    
    def create_palm_template(self, image_path: str, person_name: str = None) -> Optional[Dict]:
        """
        Create a palm template from an image
        
        Args:
            image_path: Path to the palm image
            person_name: Name/ID of the person (optional)
            
        Returns:
            Palm template dictionary or None if failed
        """
        print(f"🔍 Creating palm template from: {image_path}", file=sys.stderr)
        
        # Detect keypoints
        result = self.detect_hand_keypoints(image_path)
        if result is None:
            return None
        
        keypoints, confidences = result
        
        # Calculate distances
        raw_distances = self.calculate_knuckle_distances(keypoints)
        normalized_distances = self.normalize_distances(raw_distances)
        
        # Generate signature
        signature = self.generate_palm_signature(normalized_distances)
        
        # Create template
        template = {
            'signature': signature,
            'raw_distances': raw_distances,
            'normalized_distances': normalized_distances,
            'keypoints': keypoints.tolist(),
            'confidences': confidences.tolist(),
            'person_name': person_name,
            'image_path': str(image_path),
            'timestamp': str(Path(image_path).stat().st_mtime)
        }
        
        print(f"✅ Created palm template with signature: {signature}", file=sys.stderr)
        print(f"   Raw distances: {len(raw_distances)} measurements", file=sys.stderr)
        print(f"   Normalized distances: {len(normalized_distances)} measurements", file=sys.stderr)
        
        return template
    
    def register_palm(self, image_path: str, person_name: str) -> bool:
        """
        Register a new palm in the database
        
        Args:
            image_path: Path to the palm image
            person_name: Name/ID of the person
            
        Returns:
            True if registration successful, False otherwise
        """
        template = self.create_palm_template(image_path, person_name)
        if template is None:
            return False
        
        # Check if signature already exists
        if template['signature'] in self.palm_database:
            print(f"⚠️  Palm signature already exists for: {self.palm_database[template['signature']]['person_name']}", file=sys.stderr)
            return False
        
        # Add to database
        self.palm_database[template['signature']] = template
        self.save_database()
        
        print(f"✅ Registered palm for: {person_name}", file=sys.stderr)
        return True
    
    def recognize_palm(self, image_path: str, threshold: float = 0.1) -> Optional[Dict]:
        """
        Recognize a palm from an image
        
        Args:
            image_path: Path to the palm image
            threshold: Distance threshold for matching (lower = stricter)
            
        Returns:
            Match information or None if no match found
        """
        print(f"🔍 Recognizing palm from: {image_path}", file=sys.stderr)
        
        # Create template from input image
        template = self.create_palm_template(image_path)
        if template is None:
            return None
        
        # Compare with database
        best_match = None
        best_distance = float('inf')
        
        for signature, stored_template in self.palm_database.items():
            # Calculate distance between normalized distance vectors
            distance = self.calculate_template_distance(
                template['normalized_distances'],
                stored_template['normalized_distances']
            )
            
            if distance < best_distance:
                best_distance = distance
                best_match = stored_template
        
        # Check if match is within threshold
        if best_match and best_distance <= threshold:
            print(f"✅ Palm recognized as: {best_match['person_name']}", file=sys.stderr)
            print(f"   Match distance: {best_distance:.6f}", file=sys.stderr)
            print(f"   Threshold: {threshold}", file=sys.stderr)
            
            return {
                'match': True,
                'person_name': best_match['person_name'],
                'distance': best_distance,
                'threshold': threshold,
                'signature': best_match['signature']
            }
        else:
            print(f"❌ No matching palm found", file=sys.stderr)
            print(f"   Best distance: {best_distance:.6f}", file=sys.stderr)
            print(f"   Threshold: {threshold}", file=sys.stderr)
            
            return {
                'match': False,
                'distance': best_distance,
                'threshold': threshold
            }
    
    def calculate_template_distance(self, distances1: Dict[str, float], distances2: Dict[str, float]) -> float:
        """
        Calculate distance between two palm templates
        
        Args:
            distances1: First template's normalized distances
            distances2: Second template's normalized distances
            
        Returns:
            Euclidean distance between the templates
        """
        # Ensure both templates have the same keys
        common_keys = set(distances1.keys()) & set(distances2.keys())
        
        if len(common_keys) == 0:
            return float('inf')
        
        # Calculate Euclidean distance
        distance = 0.0
        for key in common_keys:
            diff = distances1[key] - distances2[key]
            distance += diff ** 2
        
        return np.sqrt(distance)
    
    def visualize_palm_analysis(self, image_path: str, save_path: str = None) -> np.ndarray:
        """
        Visualize palm analysis with knuckle points and distances
        
        Args:
            image_path: Path to the input image
            save_path: Path to save the visualization (optional)
            
        Returns:
            Visualization image
        """
        # Detect keypoints
        result = self.detect_hand_keypoints(image_path)
        if result is None:
            return None
        
        keypoints, confidences = result
        
        # Load image
        image = cv2.imread(str(image_path))
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Create visualization
        vis_image = image_rgb.copy()
        
        # Draw all keypoints
        for i, (kp, conf) in enumerate(zip(keypoints, confidences)):
            if conf > 0.5:
                point = tuple(kp.astype(int))
                color = (255, 0, 0) if i in self.knuckle_indices.values() else (0, 255, 0)
                cv2.circle(vis_image, point, 6, color, -1)
                cv2.circle(vis_image, point, 8, (255, 255, 255), 2)
                cv2.putText(vis_image, str(i), (point[0] + 10, point[1] - 10), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
        
        # Highlight knuckle points
        knuckle_colors = {
            'wrist': (255, 0, 0),      # Red
            'index_knuckle': (0, 255, 0),    # Green
            'middle_knuckle': (0, 0, 255),   # Blue
            'ring_knuckle': (255, 255, 0),   # Cyan
            'pinky_knuckle': (255, 0, 255)   # Magenta
        }
        
        for name, idx in self.knuckle_indices.items():
            if confidences[idx] > 0.5:
                point = tuple(keypoints[idx].astype(int))
                color = knuckle_colors[name]
                cv2.circle(vis_image, point, 10, color, -1)
                cv2.circle(vis_image, point, 12, (255, 255, 255), 2)
                cv2.putText(vis_image, name.replace('_', ' ').title(), 
                           (point[0] + 15, point[1] - 15), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        
        # Draw distance lines between knuckles
        knuckle_coords = {name: keypoints[idx] for name, idx in self.knuckle_indices.items()}
        knuckle_names = list(knuckle_coords.keys())
        
        for i, name1 in enumerate(knuckle_names):
            for j, name2 in enumerate(knuckle_names[i+1:], i+1):
                coord1 = knuckle_coords[name1]
                coord2 = knuckle_coords[name2]
                
                pt1 = tuple(coord1.astype(int))
                pt2 = tuple(coord2.astype(int))
                
                cv2.line(vis_image, pt1, pt2, (128, 128, 128), 2)
                
                # Add distance label
                mid_point = ((pt1[0] + pt2[0]) // 2, (pt1[1] + pt2[1]) // 2)
                distance = np.sqrt(np.sum((coord1 - coord2) ** 2))
                cv2.putText(vis_image, f"{distance:.1f}", mid_point, 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, (128, 128, 128), 1)
        
        # Save if requested
        if save_path:
            cv2.imwrite(save_path, cv2.cvtColor(vis_image, cv2.COLOR_RGB2BGR))
            print(f"💾 Visualization saved to: {save_path}", file=sys.stderr)
        
        return vis_image
    
    def list_registered_palms(self):
        """List all registered palms in the database"""
        if not self.palm_database:
            print("📝 No palms registered in database")
            return
        
        print(f"📋 Registered Palms ({len(self.palm_database)}):")
        print("-" * 50)
        
        for signature, template in self.palm_database.items():
            person_name = template.get('person_name', 'Unknown')
            image_path = template.get('image_path', 'Unknown')
            print(f"👤 {person_name}")
            print(f"   Signature: {signature}")
            print(f"   Image: {Path(image_path).name}")
            print(f"   Distances: {len(template['normalized_distances'])} measurements")
            print()

def main():
    """Main function for testing the palm recognition system"""
    print("🤖 Palm Recognition System")
    print("=" * 40)
    
    # Initialize system
    system = PalmRecognitionSystem()
    
    if system.model is None:
        print("❌ Cannot proceed without a trained model")
        return
    
    # Example usage
    print("\n📖 Usage Examples:")
    print("1. Register a new palm:")
    print("   system.register_palm('path/to/palm_image.jpg', 'Your Name')")
    print("\n2. Recognize a palm:")
    print("   result = system.recognize_palm('path/to/palm_image.jpg')")
    print("\n3. Visualize palm analysis:")
    print("   system.visualize_palm_analysis('path/to/palm_image.jpg', 'output.jpg')")
    print("\n4. List registered palms:")
    print("   system.list_registered_palms()")
    
    # List current database
    system.list_registered_palms()

if __name__ == "__main__":
    main()
