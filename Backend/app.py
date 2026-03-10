from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import uuid

from pipeline.evaluator import evaluate

app = FastAPI()

# Add CORS middleware to allow requests from the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "Backend is running", "engine": "scrybe.io"}

# Create directories to avoid FileNotFoundError
os.makedirs("uploads/videos", exist_ok=True)
os.makedirs("uploads/audio", exist_ok=True)

@app.post("/evaluate")
def evaluate_video(file: UploadFile = File(...), reference_answer: str = Form(...)):

    # Basic validation: ensure the user uploaded an actual media file.
    if not file.content_type.startswith("video/") and not file.content_type.startswith("audio/"):
        return {"error": f"Invalid file type '{file.content_type}'. Please upload a valid video file (e.g., .mp4, .webm)."}

    video_id = str(uuid.uuid4())
    video_path = f"uploads/videos/{video_id}.mp4"

    try:
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Optional: check if file is extremely small/empty which might indicate a corrupted upload
        if os.path.getsize(video_path) < 100:
            return {"error": "The uploaded video file is empty or corrupted."}

        result = evaluate(video_path, reference_answer)
    finally:
        file.file.close()

    return result

