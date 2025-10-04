"""
Train hand keypoint detection model on the subset dataset
Optimized for local training with limited resources
"""

import os
import torch
from ultralytics import YOLO
import yaml

def check_gpu():
    """Check if GPU is available"""
    if torch.cuda.is_available():
        print(f"🚀 GPU available: {torch.cuda.get_device_name(0)}")
        print(f"   Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
        return True
    else:
        print("💻 Using CPU (GPU not available)")
        return False

def train_hand_model():
    """Train the hand keypoint detection model"""
    
    print("🔍 Checking system resources...")
    use_gpu = check_gpu()
    
    # Check if subset dataset exists
    subset_dir = "hand_keypoint_subset"
    if not os.path.exists(subset_dir):
        print(f"❌ Subset dataset not found at {subset_dir}")
        print("   Please run 'python create_dataset_subset.py' first")
        return
    
    # Check dataset files
    train_images = len([f for f in os.listdir(f"{subset_dir}/images/train") if f.endswith('.jpg')])
    val_images = len([f for f in os.listdir(f"{subset_dir}/images/val") if f.endswith('.jpg')])
    
    print(f"📊 Dataset subset loaded:")
    print(f"   Training images: {train_images}")
    print(f"   Validation images: {val_images}")
    
    if train_images == 0 or val_images == 0:
        print("❌ No images found in dataset subset")
        return
    
    # Load model
    print("📥 Loading YOLOv8 pose model...")
    model = YOLO('yolo11n-pose.pt')  # Use nano model for faster training
    
    # Training parameters optimized for local training
    training_args = {
        'data': 'hand-keypoints-subset.yaml',
        'epochs': 50,  # Reduced epochs for faster training
        'imgsz': 416,  # Smaller image size for faster training
        'batch': 8 if use_gpu else 4,  # Smaller batch size
        'device': 'cuda' if use_gpu else 'cpu',
        'workers': 2,  # Reduced workers for stability
        'patience': 10,  # Early stopping
        'save_period': 10,  # Save checkpoint every 10 epochs
        'project': 'hand_keypoint_training',
        'name': 'subset_experiment',
        'exist_ok': True,
        'pretrained': True,
        'optimizer': 'AdamW',  # More stable optimizer
        'lr0': 0.001,  # Lower learning rate for stability
        'lrf': 0.01,  # Final learning rate factor
        'momentum': 0.937,
        'weight_decay': 0.0005,
        'warmup_epochs': 3,
        'warmup_momentum': 0.8,
        'warmup_bias_lr': 0.1,
        'box': 7.5,  # Box loss gain
        'cls': 0.5,  # Classification loss gain
        'dfl': 1.5,  # DFL loss gain
        'pose': 12.0,  # Pose loss gain (important for keypoints)
        'kobj': 2.0,  # Keypoint objectness loss gain
        'label_smoothing': 0.0,
        'nbs': 64,  # Nominal batch size
        'overlap_mask': True,
        'mask_ratio': 4,
        'dropout': 0.0,
        'val': True,  # Validate during training
        'plots': True,  # Generate training plots
        'save_json': True,  # Save results in JSON format
        'save_hybrid': False,
        'conf': None,
        'iou': 0.7,
        'max_det': 300,
        'half': use_gpu,  # Use half precision if GPU available
        'dnn': False,
        'vid_stride': 1,
        'line_width': None,
        'visualize': False,
        'augment': True,  # Enable data augmentation
        'agnostic_nms': False,
        'classes': None,
        'single_cls': False,
        'rect': False,
        'cos_lr': False,
        'close_mosaic': 10,
        'resume': False,
        'amp': use_gpu,  # Automatic mixed precision if GPU available
        'fraction': 1.0,
        'profile': False,
        'freeze': None,
        'multi_scale': False,
        'overlap_mask': True,
        'mask_ratio': 4,
        'dropout': 0.0,
        'val': True,
        'split': 'val',
        'save_dir': 'runs/pose/train',
        'verbose': True,
        'seed': 0,
        'deterministic': True,
        'single_cls': False,
        'rect': False,
        'cos_lr': False,
        'close_mosaic': 10,
        'resume': False,
        'amp': use_gpu,
        'fraction': 1.0,
        'profile': False,
        'freeze': None,
        'multi_scale': False,
        'overlap_mask': True,
        'mask_ratio': 4,
        'dropout': 0.0,
        'val': True,
        'split': 'val',
        'save_dir': 'runs/pose/train',
        'verbose': True,
        'seed': 0,
        'deterministic': True
    }
    
    print("🚀 Starting training...")
    print(f"   Epochs: {training_args['epochs']}")
    print(f"   Image size: {training_args['imgsz']}")
    print(f"   Batch size: {training_args['batch']}")
    print(f"   Device: {training_args['device']}")
    print(f"   Learning rate: {training_args['lr0']}")
    
    try:
        # Start training
        results = model.train(**training_args)
        
        print("\n✅ Training completed successfully!")
        print(f"📁 Results saved in: {results.save_dir}")
        print(f"🏆 Best model: {results.save_dir}/weights/best.pt")
        print(f"📊 Last model: {results.save_dir}/weights/last.pt")
        
        # Print training summary
        if hasattr(results, 'results_dict'):
            print("\n📈 Training Summary:")
            for key, value in results.results_dict.items():
                if isinstance(value, (int, float)):
                    print(f"   {key}: {value:.4f}")
        
        return results
        
    except Exception as e:
        print(f"❌ Training failed: {str(e)}")
        return None

def validate_model(model_path):
    """Validate the trained model"""
    print(f"\n🔍 Validating model: {model_path}")
    
    if not os.path.exists(model_path):
        print(f"❌ Model not found: {model_path}")
        return
    
    try:
        model = YOLO(model_path)
        results = model.val(data='hand-keypoints-subset.yaml')
        
        print("✅ Validation completed!")
        print(f"📊 Validation results: {results}")
        
    except Exception as e:
        print(f"❌ Validation failed: {str(e)}")

if __name__ == "__main__":
    print("🤖 Hand Keypoint Detection Training")
    print("=" * 50)
    
    # Train the model
    results = train_hand_model()
    
    if results:
        # Validate the best model
        best_model_path = f"{results.save_dir}/weights/best.pt"
        validate_model(best_model_path)
        
        print("\n🎉 Training pipeline completed!")
        print("📝 Next steps:")
        print("   1. Check the training plots in the results directory")
        print("   2. Test the model on some sample images")
        print("   3. Integrate the model into your PalmAuth server")
    else:
        print("\n❌ Training failed. Please check the error messages above.")
