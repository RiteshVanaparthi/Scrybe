import os
import uuid
from concurrent.futures import ThreadPoolExecutor

from pipeline.extract_audio import extract_audio
from pipeline.speech_to_text import transcribe_audio
from pipeline.text_cleaning import clean_text
from models.similarity_model import calculate_similarity
from utils.score_calculator import convert_to_score
from utils.summarizer import summarize_text
from utils.feedback_generator import generate_feedback
from pipeline.extract_frames import extract_frame
from utils.frame_analyzer import compare_frame_with_reference


def evaluate(video_path, reference_answer):

    audio_path = f"uploads/audio/{uuid.uuid4()}.wav"
    frame_path = None

    try:
        # Run frame extraction and audio extraction in parallel
        with ThreadPoolExecutor(max_workers=2) as executor:
            frame_future = executor.submit(extract_frame, video_path)
            audio_future = executor.submit(extract_audio, video_path, audio_path)
            
            frame_path = frame_future.result()
            audio_future.result()  # wait for audio extraction

        # Visual analysis (non-blocking, runs while we transcribe)
        visual_future = None
        if frame_path:
            pool = ThreadPoolExecutor(max_workers=1)
            visual_future = pool.submit(compare_frame_with_reference, frame_path, reference_answer)

        transcript = transcribe_audio(audio_path)

        clean_answer = clean_text(transcript)

        similarity = calculate_similarity(clean_answer, reference_answer)

        score = convert_to_score(similarity)

        # Run summarize and feedback generation in parallel (both are API calls)
        with ThreadPoolExecutor(max_workers=2) as executor:
            summary_future = executor.submit(summarize_text, transcript)
            feedback_future = executor.submit(generate_feedback, transcript, reference_answer, score)

            summary = summary_future.result()
            feedback = feedback_future.result()

        visual_feedback = None
        if visual_future:
            try:
                visual_feedback = visual_future.result(timeout=15)
            except Exception:
                visual_feedback = None

        return {
            "transcript": transcript,
            "summary": summary,
            "similarity": similarity,
            "score": score,
            "feedback": feedback,
            "visual_feedback": visual_feedback or "No visual data detected or analysis failed.",
            "message": "Evaluation completed successfully"
        }
    except Exception as e:
        return {
            "error": str(e)
        }
    finally:
        # Cleanup
        if audio_path and os.path.exists(audio_path):
            os.remove(audio_path)
        if video_path and os.path.exists(video_path):
            os.remove(video_path)
        if frame_path and os.path.exists(frame_path):
            os.remove(frame_path)