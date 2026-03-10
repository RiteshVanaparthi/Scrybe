import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel('gemini-2.0-flash')
else:
    gemini_model = None

def compare_frame_with_reference(frame_path, reference_answer):
    if not gemini_model or not frame_path:
        return "Frame analysis is unavailable."

    try:
        sample_file = genai.upload_file(path=frame_path, display_name="Video Frame")
        
        prompt = f"""
        You are an AI Interview Coach analyzing the visual performance of a candidate.
        The reference answer they are expected to talk about is: "{reference_answer}"
        
        Analyze the candidate's body language, professionalism, and visual presence based on this frame. 
        Provide a concise 2-3 sentence visual feedback.
        """
        
        response = gemini_model.generate_content([sample_file, prompt])
        
        try:
            # Cleanup uploaded file from Gemini to save space
            genai.delete_file(sample_file.name)
        except:
            pass
            
        return response.text.strip()
    except Exception as e:
        print(f"Frame Analysis Error: {e}")
        return "Unable to analyze the video frame visually."
