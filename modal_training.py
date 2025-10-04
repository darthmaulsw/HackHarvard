"""
Modal Labs training script for hand keypoint detection
This will run training on Modal's GPU instances
"""

import modal
import os
from pathlib import Path

# Create Modal app
app = modal.App("hand-keypoint-training")

# Define the image with all dependencies and add the dataset
image = (modal.Image.debian_slim(python_version="3.10")
         .pip_install([
             "ultralytics",
             "torch",
             "torchvision", 
             "opencv-python",
             "numpy",
             "pillow",
             "pyyaml",
             "matplotlib",
             "seaborn",
             "pandas",
             "tqdm"
         ])
         .add_local_dir("hand_keypoint_subset", remote_path="/data/hand_keypoint_subset"))

# Create a volume to store the dataset and results
volume = modal.Volume.from_name("hand-keypoint-data", create_if_missing=True)

@app.function(
    image=image,
    gpu="A10G",  # Use A10G GPU for training
    volumes={"/results": volume},  # Use different path for results
    timeout=3600,  # 1 hour timeout
    memory=16384,  # 16GB RAM
)
def train_hand_keypoints():
    """Train hand keypoint detection model on Modal"""
    
    import torch
    from ultralytics import YOLO
    import yaml
    import shutil
    from pathlib import Path
    
    print("🚀 Starting hand keypoint training on Modal...")
    print(f"GPU available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
    
    # Check if dataset exists
    dataset_path = Path("/data/hand_keypoint_subset")
    if not dataset_path.exists():
        print("❌ Dataset not found. The dataset should be mounted from local directory.")
        return None
    
    # Check dataset files
    train_images = list((dataset_path / "images" / "train").glob("*.jpg"))
    val_images = list((dataset_path / "images" / "val").glob("*.jpg"))
    
    print(f"📊 Dataset loaded:")
    print(f"   Training images: {len(train_images)}")
    print(f"   Validation images: {len(val_images)}")
    
    if len(train_images) == 0 or len(val_images) == 0:
        print("❌ No images found in dataset")
        return None
    
    # Create YAML config
    config = {
        'path': '/data/hand_keypoint_subset',
        'train': 'images/train',
        'val': 'images/val',
        'kpt_shape': [21, 3],
        'names': {0: 'hand'},
        'skeleton': [[0,1], [1,2], [2,3], [3,4], [0,5], [5,6], [6,7], [7,8], 
                    [0,9], [9,10], [10,11], [11,12], [0,13], [13,14], [14,15], 
                    [15,16], [0,17], [17,18], [18,19], [19,20]],
        'nc': 1
    }
    
    config_path = Path("/data/hand-keypoints-subset.yaml")
    with open(config_path, 'w') as f:
        yaml.dump(config, f)
    
    print("✅ Configuration created")
    
    # Load model
    print("📥 Loading YOLOv8 pose model...")
    model = YOLO('yolo11n-pose.pt')
    
    # Training parameters optimized for Modal GPU
    training_args = {
        'data': str(config_path),
        'epochs': 100,  # More epochs since we have powerful GPU
        'imgsz': 640,   # Full resolution
        'batch': 32,    # Larger batch size for GPU
        'device': 'cuda',
        'workers': 8,   # More workers for faster data loading
        'patience': 15,
        'save_period': 10,
        'project': '/results/training_results',
        'name': 'modal_training',
        'exist_ok': True,
        'pretrained': True,
        'optimizer': 'AdamW',
        'lr0': 0.01,
        'lrf': 0.01,
        'momentum': 0.937,
        'weight_decay': 0.0005,
        'warmup_epochs': 3,
        'warmup_momentum': 0.8,
        'warmup_bias_lr': 0.1,
        'box': 7.5,
        'cls': 0.5,
        'dfl': 1.5,
        'pose': 12.0,
        'kobj': 2.0,
        'label_smoothing': 0.0,
        'nbs': 64,
        'overlap_mask': True,
        'mask_ratio': 4,
        'dropout': 0.0,
        'val': True,
        'plots': True,
        'save_json': True,
        'save_hybrid': False,
        'conf': None,
        'iou': 0.7,
        'max_det': 300,
        'half': True,  # Use half precision
        'dnn': False,
        'vid_stride': 1,
        'line_width': None,
        'visualize': False,
        'augment': True,
        'agnostic_nms': False,
        'classes': None,
        'single_cls': False,
        'rect': False,
        'cos_lr': False,
        'close_mosaic': 10,
        'resume': False,
        'amp': True,
        'fraction': 1.0,
        'profile': False,
        'freeze': None,
        'multi_scale': False,
        'overlap_mask': True,
        'mask_ratio': 4,
        'dropout': 0.0,
        'val': True,
        'split': 'val',
        'save_dir': '/results/training_results',
        'verbose': True,
        'seed': 42,
        'deterministic': True
    }
    
    print("🚀 Starting training...")
    print(f"   Epochs: {training_args['epochs']}")
    print(f"   Image size: {training_args['imgsz']}")
    print(f"   Batch size: {training_args['batch']}")
    print(f"   Learning rate: {training_args['lr0']}")
    
    try:
        # Start training
        results = model.train(**training_args)
        
        print("\n✅ Training completed successfully!")
        print(f"📁 Results saved in: {results.save_dir}")
        
        # Commit the volume to save results
        volume.commit()
        
        return {
            'success': True,
            'save_dir': str(results.save_dir),
            'best_model': f"{results.save_dir}/weights/best.pt",
            'last_model': f"{results.save_dir}/weights/last.pt"
        }
        
    except Exception as e:
        print(f"❌ Training failed: {str(e)}")
        return {'success': False, 'error': str(e)}

@app.function(
    image=image,
    volumes={"/data": volume}
)
def upload_dataset():
    """Upload dataset to Modal volume"""
    
    import shutil
    from pathlib import Path
    
    print("📤 Uploading dataset to Modal...")
    
    # The dataset should be mounted from the local directory
    # Check if it's already in the volume
    dest_path = Path("/data/hand_keypoint_subset")
    if dest_path.exists():
        print("✅ Dataset already exists in Modal volume")
        train_images = list((dest_path / "images" / "train").glob("*.jpg"))
        val_images = list((dest_path / "images" / "val").glob("*.jpg"))
        print(f"   Training images: {len(train_images)}")
        print(f"   Validation images: {len(val_images)}")
        return True
    
    print("❌ Dataset not found in Modal volume")
    print("   The dataset should be uploaded via the main function")
    return False

@app.function(
    image=image,
    volumes={"/results": volume}
)
def download_results():
    """Download training results from Modal"""
    
    import shutil
    from pathlib import Path
    
    print("📥 Downloading training results...")
    
    results_path = Path("/results/training_results")
    if not results_path.exists():
        print("❌ No training results found")
        return False
    
    # Download to local directory
    local_results = Path("modal_training_results")
    if local_results.exists():
        shutil.rmtree(local_results)
    
    shutil.copytree(results_path, local_results)
    
    print(f"✅ Results downloaded to: {local_results.absolute()}")
    
    # List downloaded files
    for item in local_results.rglob("*"):
        if item.is_file():
            print(f"   {item.relative_to(local_results)}")
    
    return True

@app.local_entrypoint()
def main():
    """Main entrypoint for Modal training"""
    
    print("🤖 Hand Keypoint Training on Modal Labs")
    print("=" * 50)
    
    # Check if local dataset exists
    from pathlib import Path
    local_subset = Path("hand_keypoint_subset")
    if not local_subset.exists():
        print("❌ Local subset dataset not found")
        print("   Please run 'python create_dataset_subset.py' first")
        return
    
    print("✅ Local dataset found, proceeding with training...")
    
    # Step 1: Train model (this will handle dataset upload internally)
    print("\n1. Training model...")
    training_result = train_hand_keypoints.remote()
    
    if not training_result or not training_result.get('success'):
        print("❌ Training failed")
        if training_result:
            print(f"   Error: {training_result.get('error')}")
        return
    
    print("✅ Training completed successfully!")
    print(f"📁 Results saved in Modal volume")
    
    # Step 2: Download results
    print("\n2. Downloading results...")
    download_success = download_results.remote()
    
    if download_success:
        print("\n🎉 All done! Check the 'modal_training_results' directory for your trained model.")
    else:
        print("❌ Failed to download results")
