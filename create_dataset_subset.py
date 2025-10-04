"""
Create a smaller subset of the hand keypoint dataset for faster training
Samples 3000 training images and 1000 validation images
"""

import os
import shutil
import random
from pathlib import Path
import json

def create_dataset_subset():
    # Set random seed for reproducibility
    random.seed(42)
    
    # Source and destination paths
    source_dir = Path("hand_keypoint_dataset_26k/hand_keypoint_dataset_26k")
    dest_dir = Path("hand_keypoint_subset")
    
    # Create destination directory structure
    dest_dir.mkdir(exist_ok=True)
    (dest_dir / "images" / "train").mkdir(parents=True, exist_ok=True)
    (dest_dir / "images" / "val").mkdir(parents=True, exist_ok=True)
    (dest_dir / "labels" / "train").mkdir(parents=True, exist_ok=True)
    (dest_dir / "labels" / "val").mkdir(parents=True, exist_ok=True)
    (dest_dir / "coco_annotation" / "train").mkdir(parents=True, exist_ok=True)
    (dest_dir / "coco_annotation" / "val").mkdir(parents=True, exist_ok=True)
    
    # Get all training images
    train_images_dir = source_dir / "images" / "train"
    train_images = list(train_images_dir.glob("*.jpg"))
    print(f"Found {len(train_images)} training images")
    
    # Get all validation images
    val_images_dir = source_dir / "images" / "val"
    val_images = list(val_images_dir.glob("*.jpg"))
    print(f"Found {len(val_images)} validation images")
    
    # Sample training images (3000)
    if len(train_images) >= 3000:
        sampled_train = random.sample(train_images, 3000)
    else:
        sampled_train = train_images
        print(f"Warning: Only {len(train_images)} training images available, using all")
    
    # Sample validation images (1000)
    if len(val_images) >= 1000:
        sampled_val = random.sample(val_images, 1000)
    else:
        sampled_val = val_images
        print(f"Warning: Only {len(val_images)} validation images available, using all")
    
    print(f"Sampling {len(sampled_train)} training images and {len(sampled_val)} validation images")
    
    # Copy training files
    print("Copying training files...")
    for i, img_path in enumerate(sampled_train):
        if i % 500 == 0:
            print(f"  Progress: {i}/{len(sampled_train)}")
        
        # Copy image
        dest_img = dest_dir / "images" / "train" / img_path.name
        shutil.copy2(img_path, dest_img)
        
        # Copy corresponding label
        label_path = source_dir / "labels" / "train" / (img_path.stem + ".txt")
        if label_path.exists():
            dest_label = dest_dir / "labels" / "train" / (img_path.stem + ".txt")
            shutil.copy2(label_path, dest_label)
    
    # Copy validation files
    print("Copying validation files...")
    for i, img_path in enumerate(sampled_val):
        if i % 200 == 0:
            print(f"  Progress: {i}/{len(sampled_val)}")
        
        # Copy image
        dest_img = dest_dir / "images" / "val" / img_path.name
        shutil.copy2(img_path, dest_img)
        
        # Copy corresponding label
        label_path = source_dir / "labels" / "val" / (img_path.stem + ".txt")
        if label_path.exists():
            dest_label = dest_dir / "labels" / "val" / (img_path.stem + ".txt")
            shutil.copy2(label_path, dest_label)
    
    # Create subset COCO annotations (simplified version)
    print("Creating COCO annotations...")
    create_subset_coco_annotations(source_dir, dest_dir, sampled_train, sampled_val)
    
    # Copy the hand landmarks visualization
    landmarks_src = source_dir / "hand_landmarks.png"
    if landmarks_src.exists():
        shutil.copy2(landmarks_src, dest_dir / "hand_landmarks.png")
    
    # Copy readme
    readme_src = source_dir / "readme.txt"
    if readme_src.exists():
        shutil.copy2(readme_src, dest_dir / "readme.txt")
    
    print(f"\n✅ Dataset subset created successfully!")
    print(f"📁 Location: {dest_dir.absolute()}")
    print(f"📊 Training images: {len(sampled_train)}")
    print(f"📊 Validation images: {len(sampled_val)}")
    print(f"📊 Total images: {len(sampled_train) + len(sampled_val)}")

def create_subset_coco_annotations(source_dir, dest_dir, sampled_train, sampled_val):
    """Create simplified COCO annotations for the subset"""
    
    # Load original COCO annotations
    train_coco_path = source_dir / "coco_annotation" / "train" / "_annotations.coco.json"
    val_coco_path = source_dir / "coco_annotation" / "val" / "_annotations.coco.json"
    
    # Create subset annotations
    for split, sampled_images, coco_path in [
        ("train", sampled_train, train_coco_path),
        ("val", sampled_val, val_coco_path)
    ]:
        if coco_path.exists():
            with open(coco_path, 'r') as f:
                coco_data = json.load(f)
            
            # Get image names from sampled images
            sampled_names = {img.stem for img in sampled_images}
            
            # Filter images and annotations
            subset_images = [img for img in coco_data['images'] if img['file_name'].replace('.jpg', '') in sampled_names]
            subset_image_ids = {img['id'] for img in subset_images}
            subset_annotations = [ann for ann in coco_data['annotations'] if ann['image_id'] in subset_image_ids]
            
            # Create subset COCO data
            subset_coco = {
                'info': coco_data['info'],
                'licenses': coco_data['licenses'],
                'categories': coco_data['categories'],
                'images': subset_images,
                'annotations': subset_annotations
            }
            
            # Save subset COCO annotation
            subset_coco_path = dest_dir / "coco_annotation" / split / "_annotations.coco.json"
            with open(subset_coco_path, 'w') as f:
                json.dump(subset_coco, f, indent=2)
            
            print(f"  Created {split} COCO annotation with {len(subset_images)} images and {len(subset_annotations)} annotations")

if __name__ == "__main__":
    create_dataset_subset()
