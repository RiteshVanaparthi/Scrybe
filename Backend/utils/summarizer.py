import re
import os
from collections import Counter
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-2.0-flash')
else:
    model = None

def _get_gemini_summary(text: str) -> str:
    """Get abstractive summary from Gemini AI."""
    if not model:
        return ""
    
    prompt = f"""Summarize the following transcript in exactly 2-3 concise sentences. 
Focus only on the key technical points. Do NOT repeat the transcript verbatim.
Your summary must be significantly shorter than the original text.

Transcript: "{text}"

Summary:"""
    
    try:
        response = model.generate_content(prompt)
        summary = response.text.strip()
        # Guard: if the "summary" is nearly as long as the original, reject it
        if len(summary) > len(text) * 0.7:
            return ""
        return summary
    except Exception as e:
        print(f"Gemini Summarizer Error: {e}")
        return ""

def summarize_text(text: str, num_sentences: int = 3) -> str:
    """
    Summarizes text using Gemini AI with an extractive fallback.
    """
    if not text or not text.strip():
        return "No transcript available to summarize."

    # Try Gemini first for a high-quality abstractive summary
    gemini_summary = _get_gemini_summary(text)
    if gemini_summary:
        return gemini_summary

    # Fallback to extractive summarizer
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    if len(sentences) <= num_sentences:
        return text.strip()

    stop_words = {
        "a", "an", "the", "is", "it", "in", "on", "at", "to", "and", "or",
        "but", "of", "for", "with", "that", "this", "was", "are", "be",
        "as", "by", "from", "so", "if", "about", "up", "we", "i", "you",
        "he", "she", "they", "them", "his", "her", "its", "our", "your",
        "my", "me", "do", "not", "have", "has", "had", "can", "will",
        "would", "could", "should", "also", "just", "like", "um", "uh",
    }

    words = re.findall(r'\b[a-z]+\b', text.lower())
    word_freq = Counter(w for w in words if w not in stop_words)

    def score_sentence(sentence):
        tokens = re.findall(r'\b[a-z]+\b', sentence.lower())
        return sum(word_freq.get(t, 0) for t in tokens if t not in stop_words)

    scored = sorted(enumerate(sentences), key=lambda x: score_sentence(x[1]), reverse=True)
    top_indices = sorted([i for i, _ in scored[:num_sentences]])
    summary = " ".join(sentences[i] for i in top_indices)

    return summary.strip()

