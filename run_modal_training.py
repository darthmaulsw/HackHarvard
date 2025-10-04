"""
Simple script to run Modal training
This script handles the setup and execution
"""

import subprocess
import sys
import os
from pathlib import Path

def check_modal_installed():
    """Check if Modal is installed"""
    try:
        import modal
        print("✅ Modal is installed")
        return True
    except ImportError:
        print("❌ Modal is not installed")
        print("   Install with: pip install modal")
        return False

def check_modal_auth():
    """Check if Modal is authenticated"""
    try:
        result = subprocess.run(["modal", "token", "current"], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Modal is authenticated")
            return True
        else:
            print("❌ Modal is not authenticated")
            print("   Run: modal token new")
            return False
    except FileNotFoundError:
        print("❌ Modal CLI not found")
        return False

def check_dataset():
    """Check if dataset subset exists"""
    subset_path = Path("hand_keypoint_subset")
    if subset_path.exists():
        train_images = len(list((subset_path / "images" / "train").glob("*.jpg")))
        val_images = len(list((subset_path / "images" / "val").glob("*.jpg")))
        print(f"✅ Dataset subset found ({train_images} train, {val_images} val)")
        return True
    else:
        print("❌ Dataset subset not found")
        print("   Run: python create_dataset_subset.py")
        return False

def main():
    """Main function to run Modal training"""
    
    print("🤖 Modal Labs Training Setup")
    print("=" * 40)
    
    # Check prerequisites
    print("\n1. Checking prerequisites...")
    
    if not check_modal_installed():
        return
    
    if not check_modal_auth():
        return
    
    if not check_dataset():
        return
    
    print("\n✅ All prerequisites met!")
    
    # Ask user if they want to proceed
    print("\n🚀 Ready to start training on Modal Labs")
    print("   This will:")
    print("   - Upload your dataset to Modal")
    print("   - Train the model on A10G GPU")
    print("   - Download results to your local machine")
    print("   - Cost approximately $0.55-$1.10")
    
    response = input("\nProceed with training? (y/n): ").lower().strip()
    
    if response != 'y':
        print("Training cancelled")
        return
    
    # Run Modal training
    print("\n🚀 Starting Modal training...")
    print("   This may take 30-60 minutes...")
    
    try:
        result = subprocess.run(["modal", "run", "modal_training.py"], 
                              check=True, text=True)
        print("\n🎉 Training completed successfully!")
        print("   Check the 'modal_training_results' directory for your model")
        
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Training failed: {e}")
        print("   Check the error messages above")
        
    except KeyboardInterrupt:
        print("\n⏹️ Training interrupted by user")

if __name__ == "__main__":
    main()
