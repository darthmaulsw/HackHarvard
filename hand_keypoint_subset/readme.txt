Hand Keypoint Dataset


Overview
This dataset contains 26,768 images of hands annotated with keypoints, making it suitable for training models for hand detection and keypoint estimation. The annotations were generated using the MediaPipe library, ensuring high accuracy and consistency. The dataset is compatible with both COCO and YOLOv8 formats.


Dataset Structure
The dataset is organized as follows:


hand_keypoint_dataset/
│
├── images/
│   ├── train/
│   ├── val/
│  
│
├── coco_annotation/
│   ├── train/
│   │   ├── _annotations.coco.json
│   ├── val/
│   │   ├── _annotations.coco.json
│
│   
├── labels/
│   ├── train/
│   ├── val/
│  
│
└── README.md


images: Contains all the images divided into training and validation.
annotations: Contains the annotations for the images in COCO.
labels: Contains the annotations for the images in YOLO formats.



Keypoints
The dataset includes keypoints for hand detection. The keypoints are annotated as follows:

1. Wrist
2. Thumb (4 points)
3. Index finger (4 points)
4. Middle finger (4 points)
5. Ring finger (4 points)
6. Little finger (4 points)

Each hand has a total of 21 keypoints.



Usage


COCO Format
To use the dataset with COCO-compatible models, you can directly load the JSON files using COCO APIs available in various deep learning frameworks.


YOLOv8 Format
For YOLOv8, ensure you have the required environment set up. You can use the provided text files to train YOLOv8 models by specifying the dataset path in your configuration file.


Credits
We would like to thank the following sources for providing the images used in this dataset:

https://sites.google.com/view/11khands
https://www.kaggle.com/datasets/ritikagiridhar/2000-hand-gestures
https://www.kaggle.com/datasets/imsparsh/gesture-recognition

The images were collected and used under the respective licenses provided by each platform.


License
This dataset is provided for educational and research purposes. Please ensure you adhere to the original licensing terms of the image sources when using the dataset.

---

For any questions or issues, please contact its.riondsilva@gmail.com.

Thank you for using the Hand Keypoint Dataset!

