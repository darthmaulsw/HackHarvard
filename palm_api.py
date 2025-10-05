"""
Palm Processing API Script
Handles palm registration and recognition via command-line interface
Stores minimal data: phone number + palm signature measurements
"""

import sys
import json
import os
from pathlib import Path
from palm_recognition_system import PalmRecognitionSystem
from datetime import datetime

# Get the script's directory to build absolute paths
SCRIPT_DIR = Path(__file__).resolve().parent

# Directory for palm data storage
PALM_DATA_DIR = SCRIPT_DIR / "palm_data"
PALM_DATA_DIR.mkdir(exist_ok=True)

# Directory for temporary images
TEMP_IMAGE_DIR = PALM_DATA_DIR / "temp_images"
TEMP_IMAGE_DIR.mkdir(exist_ok=True)

# Model path
MODEL_PATH = SCRIPT_DIR / "modal_training_results" / "best.pt"

def get_palm_data_path(phone_number: str) -> Path:
    """Get the path to the palm data file for a phone number"""
    return PALM_DATA_DIR / f"{phone_number}.json"

def load_palm_data(phone_number: str) -> dict:
    """Load palm data for a phone number"""
    path = get_palm_data_path(phone_number)
    if path.exists():
        print(f"📂 Loading existing palm data for {phone_number}", file=sys.stderr)
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            print(f"❌ Error: {e}", file=sys.stderr)
            print(f"⚠️  Corrupted palm data file found, deleting...", file=sys.stderr)
            try:
                os.remove(path)
                print(f"🗑️  Deleted corrupted file: {path}", file=sys.stderr)
            except Exception as delete_error:
                print(f"❌ Failed to delete corrupted file: {delete_error}", file=sys.stderr)
            return None
    print(f"📝 No existing palm data found for {phone_number}", file=sys.stderr)
    return None

def save_palm_data(phone_number: str, palm_data: dict) -> bool:
    """Save palm data for a phone number"""
    try:
        path = get_palm_data_path(phone_number)
        
        # Convert any numpy types to native Python types for JSON serialization
        def convert_to_native(obj):
            """Recursively convert numpy types to native Python types"""
            import numpy as np
            
            if isinstance(obj, dict):
                return {key: convert_to_native(value) for key, value in obj.items()}
            elif isinstance(obj, list):
                return [convert_to_native(item) for item in obj]
            elif isinstance(obj, (np.integer, np.floating)):
                return obj.item()  # Convert numpy scalar to Python scalar
            elif isinstance(obj, np.ndarray):
                return obj.tolist()  # Convert numpy array to Python list
            else:
                return obj
        
        palm_data_native = convert_to_native(palm_data)
        
        with open(path, 'w') as f:
            json.dump(palm_data_native, f, indent=2)
        print(f"💾 Saved palm data to {path}", file=sys.stderr)
        return True
    except Exception as e:
        print(f"❌ Failed to save palm data: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return False

def register_palm(image_path: str, phone_number: str) -> dict:
    """
    Register a palm for a phone number
    
    Args:
        image_path: Path to the palm image
        phone_number: Phone number to associate with the palm
        
    Returns:
        Result dictionary with success status and data
    """
    print(f"🚀 Starting palm registration for {phone_number}", file=sys.stderr)
    print(f"📸 Image path: {image_path}", file=sys.stderr)
    
    # Check if image exists
    if not os.path.exists(image_path):
        print(f"❌ Image not found: {image_path}", file=sys.stderr)
        return {
            "success": False,
            "message": f"Image not found: {image_path}"
        }
    
    # Initialize palm recognition system
    print("🤖 Initializing palm recognition system...", file=sys.stderr)
    print(f"📂 Model path: {MODEL_PATH}", file=sys.stderr)
    print(f"📂 Model exists: {MODEL_PATH.exists()}", file=sys.stderr)
    system = PalmRecognitionSystem(model_path=str(MODEL_PATH))
    
    if system.model is None:
        print("❌ Palm recognition model not loaded", file=sys.stderr)
        return {
            "success": False,
            "message": "Palm recognition model not available"
        }
    
    # Check if palm already registered
    existing_data = load_palm_data(phone_number)
    if existing_data:
        print(f"⚠️  Palm already registered for {phone_number}", file=sys.stderr)
        return {
            "success": False,
            "message": "Palm already registered for this phone number. Please delete existing registration first."
        }
    
    # Create palm template
    print("🔍 Analyzing palm image...", file=sys.stderr)
    template = system.create_palm_template(image_path)
    
    if template is None:
        print("❌ Failed to create palm template", file=sys.stderr)
        return {
            "success": False,
            "message": "Failed to detect hand keypoints in image. Please ensure your palm is clearly visible."
        }
    
    print(f"✅ Palm template created successfully", file=sys.stderr)
    print(f"   Signature: {template['signature']}", file=sys.stderr)
    print(f"   Measurements: {len(template['normalized_distances'])}", file=sys.stderr)
    
    # Create minimal palm data (only what's needed for comparison)
    palm_data = {
        "phoneNumber": phone_number,
        "signature": template['signature'],
        "normalizedDistances": template['normalized_distances'],
        "rawDistances": template['raw_distances'],
        "registeredAt": datetime.utcnow().isoformat(),
        "lastUsed": datetime.utcnow().isoformat()
    }
    
    # Save palm data
    if save_palm_data(phone_number, palm_data):
        print(f"✅ Palm registered successfully for {phone_number}", file=sys.stderr)
        return {
            "success": True,
            "message": "Palm registered successfully",
            "data": {
                "phoneNumber": phone_number,
                "signature": template['signature'],
                "registeredAt": palm_data['registeredAt']
            }
        }
    else:
        print(f"❌ Failed to save palm data", file=sys.stderr)
        return {
            "success": False,
            "message": "Failed to save palm data"
        }

def recognize_palm(image_path: str, phone_number: str = None, threshold: float = 0.13) -> dict:
    """
    Recognize a palm from an image
    
    Args:
        image_path: Path to the palm image
        phone_number: Optional phone number to match against (if provided, only checks this user)
        threshold: Distance threshold for matching
        
    Returns:
        Result dictionary with match status and data
    """
    print(f"🔍 Starting palm recognition", file=sys.stderr)
    if phone_number:
        print(f"📱 Matching against: {phone_number}", file=sys.stderr)
    else:
        print(f"📱 Matching against all registered palms", file=sys.stderr)
    print(f"📸 Image path: {image_path}", file=sys.stderr)
    
    # Check if image exists
    if not os.path.exists(image_path):
        print(f"❌ Image not found: {image_path}", file=sys.stderr)
        return {
            "success": False,
            "message": f"Image not found: {image_path}"
        }
    
    # Initialize palm recognition system
    print("🤖 Initializing palm recognition system...", file=sys.stderr)
    print(f"📂 Model path: {MODEL_PATH}", file=sys.stderr)
    print(f"📂 Model exists: {MODEL_PATH.exists()}", file=sys.stderr)
    system = PalmRecognitionSystem(model_path=str(MODEL_PATH))
    
    if system.model is None:
        print("❌ Palm recognition model not loaded", file=sys.stderr)
        return {
            "success": False,
            "message": "Palm recognition model not available"
        }
    
    # Create template from input image
    print("🔍 Analyzing palm image...", file=sys.stderr)
    template = system.create_palm_template(image_path)
    
    if template is None:
        print("❌ Failed to create palm template", file=sys.stderr)
        return {
            "success": False,
            "message": "Failed to detect hand keypoints in image"
        }
    
    print(f"✅ Palm template created", file=sys.stderr)
    print(f"   Signature: {template['signature']}", file=sys.stderr)
    
    # Load palm data to compare against
    palm_files = []
    if phone_number:
        # Only check specific phone number
        palm_file = get_palm_data_path(phone_number)
        if palm_file.exists():
            palm_files = [palm_file]
        else:
            print(f"❌ No palm registered for {phone_number}", file=sys.stderr)
            return {
                "success": False,
                "match": False,
                "message": f"No palm registered for {phone_number}"
            }
    else:
        # Check all registered palms
        palm_files = list(PALM_DATA_DIR.glob("*.json"))
    
    if not palm_files:
        print("❌ No registered palms found", file=sys.stderr)
        return {
            "success": False,
            "match": False,
            "message": "No registered palms in database"
        }
    
    print(f"🔍 Comparing against {len(palm_files)} registered palm(s)...", file=sys.stderr)
    
    # Compare with registered palms
    best_match = None
    best_distance = float('inf')
    
    for palm_file in palm_files:
        try:
            with open(palm_file, 'r') as f:
                stored_data = json.load(f)
            
            # Calculate distance
            distance = system.calculate_template_distance(
                template['normalized_distances'],
                stored_data['normalizedDistances']
            )
            
            print(f"   📊 {stored_data['phoneNumber']}: distance = {distance:.6f}", file=sys.stderr)
            
            if distance < best_distance:
                best_distance = distance
                best_match = stored_data
        except json.JSONDecodeError as e:
            print(f"⚠️  Skipping corrupted file {palm_file.name}: {e}", file=sys.stderr)
            continue
    
    # Check if match is within threshold
    print(f"🎯 Best match distance: {best_distance:.6f}", file=sys.stderr)
    print(f"🎯 Threshold: {threshold}", file=sys.stderr)
    
    if best_match and best_distance <= threshold:
        print(f"✅ Palm recognized as: {best_match['phoneNumber']}", file=sys.stderr)
        
        # Update last used timestamp
        best_match['lastUsed'] = datetime.utcnow().isoformat()
        save_palm_data(best_match['phoneNumber'], best_match)
        
        return {
            "success": True,
            "match": True,
            "message": "Palm recognized successfully",
            "data": {
                "phoneNumber": best_match['phoneNumber'],
                "distance": best_distance,
                "confidence": 1 - best_distance,
                "threshold": threshold
            }
        }
    else:
        print(f"❌ No matching palm found (best distance: {best_distance:.6f})", file=sys.stderr)
        return {
            "success": True,
            "match": False,
            "message": "Palm not recognized",
            "data": {
                "distance": best_distance,
                "threshold": threshold
            }
        }

def delete_palm(phone_number: str) -> dict:
    """Delete palm registration for a phone number"""
    print(f"🗑️  Deleting palm data for {phone_number}", file=sys.stderr)
    
    palm_file = get_palm_data_path(phone_number)
    if palm_file.exists():
        os.remove(palm_file)
        print(f"✅ Palm data deleted for {phone_number}", file=sys.stderr)
        return {
            "success": True,
            "message": "Palm registration deleted successfully"
        }
    else:
        print(f"❌ No palm data found for {phone_number}", file=sys.stderr)
        return {
            "success": False,
            "message": "No palm registered for this phone number"
        }

def list_registered_palms() -> dict:
    """List all registered palms"""
    print("📋 Listing all registered palms...", file=sys.stderr)
    
    palm_files = list(PALM_DATA_DIR.glob("*.json"))
    
    palms = []
    for palm_file in palm_files:
        try:
            with open(palm_file, 'r') as f:
                data = json.load(f)
                palms.append({
                    "phoneNumber": data['phoneNumber'],
                    "registeredAt": data['registeredAt'],
                    "lastUsed": data.get('lastUsed', data['registeredAt'])
                })
        except json.JSONDecodeError as e:
            print(f"⚠️  Skipping corrupted file {palm_file.name}: {e}", file=sys.stderr)
    
    print(f"✅ Found {len(palms)} registered palm(s)", file=sys.stderr)
    return {
        "success": True,
        "count": len(palms),
        "palms": palms
    }

def main():
    """Main function - command line interface"""
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "message": "Missing command. Usage: python palm_api.py <command> [args...]"
        }))
        sys.exit(1)
    
    command = sys.argv[1]
    print(f"🎯 Command: {command}", file=sys.stderr)
    print(f"📝 Arguments: {sys.argv[2:]}", file=sys.stderr)
    
    try:
        result = None
        
        if command == "register":
            if len(sys.argv) < 4:
                result = {
                    "success": False,
                    "message": "Usage: python palm_api.py register <image_path> <phone_number>"
                }
            else:
                image_path = sys.argv[2]
                phone_number = sys.argv[3]
                result = register_palm(image_path, phone_number)
        
        elif command == "recognize":
            if len(sys.argv) < 3:
                result = {
                    "success": False,
                    "message": "Usage: python palm_api.py recognize <image_path> [phone_number] [threshold]"
                }
            else:
                image_path = sys.argv[2]
                phone_number = sys.argv[3] if len(sys.argv) > 3 else None
                threshold = float(sys.argv[4]) if len(sys.argv) > 4 else 0.13
                result = recognize_palm(image_path, phone_number, threshold)
        
        elif command == "delete":
            if len(sys.argv) < 3:
                result = {
                    "success": False,
                    "message": "Usage: python palm_api.py delete <phone_number>"
                }
            else:
                phone_number = sys.argv[2]
                result = delete_palm(phone_number)
        
        elif command == "list":
            result = list_registered_palms()
        
        else:
            result = {
                "success": False,
                "message": f"Unknown command: {command}. Valid commands: register, recognize, delete, list"
            }
        
        # Convert to native types before JSON output
        def convert_to_native(obj):
            """Recursively convert numpy types to native Python types"""
            import numpy as np
            
            if isinstance(obj, dict):
                return {key: convert_to_native(value) for key, value in obj.items()}
            elif isinstance(obj, list):
                return [convert_to_native(item) for item in obj]
            elif isinstance(obj, (np.integer, np.floating)):
                return obj.item()  # Convert numpy scalar to Python scalar
            elif isinstance(obj, np.ndarray):
                return obj.tolist()  # Convert numpy array to Python list
            else:
                return obj
        
        result_native = convert_to_native(result)
        
        # Output result as JSON to stdout
        print(json.dumps(result_native, indent=2))
        
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({
            "success": False,
            "message": f"Error: {str(e)}"
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()

