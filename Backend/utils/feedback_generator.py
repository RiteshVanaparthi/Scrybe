import re
import os
import json
from collections import Counter
import google.generativeai as genai
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Google Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel('gemini-2.0-flash')
else:
    gemini_model = None

# Configure OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
else:
    openai_client = None

# Common English stop words to ignore during concept extraction
_STOP_WORDS = {
    "a", "an", "the", "is", "it", "in", "on", "at", "to", "and", "or",
    "but", "of", "for", "with", "that", "this", "was", "are", "be",
    "as", "by", "from", "so", "if", "about", "up", "we", "i", "you",
    "he", "she", "they", "them", "his", "her", "its", "our", "your",
    "my", "me", "do", "not", "have", "has", "had", "can", "will",
    "would", "could", "should", "also", "just", "like", "um", "uh",
    "when", "then", "than", "what", "which", "who", "how", "there",
    "their", "been", "being", "into", "through", "during", "before",
    "after", "because", "while", "where", "were", "more", "most",
    "other", "some", "such", "no", "nor", "very", "still", "each",
    "few", "get", "got", "may", "any", "all", "both", "between",
    "same", "different", "use", "used", "using", "make", "made", "one",
    "two", "three", "first", "second", "last", "much", "many",
}


def _extract_keywords(text: str, top_n: int = 15) -> list[str]:
    """Extract the top N significant keywords from a text, sorted by frequency."""
    tokens = re.findall(r'\b[a-z]{3,}\b', text.lower())
    filtered = [w for w in tokens if w not in _STOP_WORDS]
    freq = Counter(filtered)
    return [word for word, _ in freq.most_common(top_n)]


def _extract_key_phrases(text: str) -> list[str]:
    """
    Extract meaningful 2-word noun-like phrases (bigrams) from text.
    Used to find topic-level concepts like 'external force', 'newton law'.
    """
    tokens = re.findall(r'\b[a-z]{3,}\b', text.lower())
    filtered = [w for w in tokens if w not in _STOP_WORDS]
    bigrams = [f"{filtered[i]} {filtered[i+1]}" for i in range(len(filtered) - 1)]
    freq = Counter(bigrams)
    return [phrase for phrase, _ in freq.most_common(10)]


def _keyword_present(keyword: str, text: str) -> bool:
    """Check if a keyword (or its partial root) appears in the text."""
    text_lower = text.lower()
    # Direct match
    if keyword in text_lower:
        return True
    # Partial / root match
    root = keyword[:5].lower()
    if len(root) >= 4 and root in text_lower:
        return True
    return False


def _get_openai_analysis(transcript: str, reference_answer: str, score: float, missing_concepts: list[str], strengths_concepts: list[str]) -> dict:
    """Get deep-dive analysis from ChatGPT (OpenAI)."""
    if not openai_client:
        return {}

    prompt = f"""
    You are a premium AI Interview Coach. Provide a high-fidelity analysis of the candidate's response.
    
    Similarity Score: {score}/100
    Reference Answer: "{reference_answer}"
    Candidate Transcript: "{transcript}"
    
    Task:
    1. STRENGTHS: For each of {strengths_concepts}, write a sentence.
    2. MISSING: For each of {missing_concepts}, write a sentence.
    3. SUGGESTIONS: 3 types (Technical, Communication, Structural).
    4. DEEP DIVE: 2-paragraph analysis.

    Format your response AS JSON with the following structure:
    {{
      "strengths": ["Sentence 1", "Sentence 2", ...],
      "missing": ["Sentence 1", "Sentence 2", ...],
      "suggestions": [
        {{"type": "Technical", "content": "..."}},
        {{"type": "Communication", "content": "..."}},
        {{"type": "Structural", "content": "..."}}
      ],
      "deep_dive": "Narrative analysis text"
    }}
    """

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"OpenAI Analysis Error: {e}")
        return {}


def _get_gemini_advanced_analysis(transcript: str, reference_answer: str, score: float, missing_concepts: list[str], strengths_concepts: list[str]) -> dict:
    """Get deep-dive analysis and sentence-based feedback from Gemini AI."""
    if not gemini_model:
        return {}
    
    prompt = f"""
    You are an AI Interview Coach providing a high-fidelity 'Deep Dive' analysis.
    
    Similarity Score: {score}/100
    Reference Answer: "{reference_answer}"
    Candidate Transcript: "{transcript}"
    
    Task:
    1. STRENGTHS: For each of these keywords {', '.join(strengths_concepts)}, write a 1-sentence explanation of how the candidate successfully covered it.
    2. MISSING: For each of these keywords {', '.join(missing_concepts)}, write a 1-sentence explanation of why it was important and how the candidate missed it.
    3. SUGGESTIONS: Provide 3 distinct suggestions (Technical, Communication, Structural) with a header for each.
    4. DEEP DIVE: Write a 2-paragraph comprehensive analysis of the candidate's performance, focusing on nuance, technical accuracy, and delivery.
    
    Format EXACTLY as:
    STRENGTH_SENTENCES:
    - [Sentence 1]
    - [Sentence 2]
    ...
    MISSING_SENTENCES:
    - [Sentence 1]
    - [Sentence 2]
    ...
    SUGGESTIONS:
    TYPE: [Type]
    CONTENT: [Content]
    ...
    DEEP_DIVE:
    [Paragraph 1]
    [Paragraph 2]
    """
    
    try:
        response = gemini_model.generate_content(prompt)
        text = response.text.strip()
        
        result = {
            "strengths": [],
            "missing": [],
            "suggestions": [],
            "deep_dive": ""
        }
        
        # Parsing logic
        sections = re.split(r'(STRENGTH_SENTENCES:|MISSING_SENTENCES:|SUGGESTIONS:|DEEP_DIVE:)', text)
        
        current_section = None
        for i in range(len(sections)):
            val = sections[i].strip()
            if val == "STRENGTH_SENTENCES:":
                current_section = "strengths"
            elif val == "MISSING_SENTENCES:":
                current_section = "missing"
            elif val == "SUGGESTIONS:":
                current_section = "suggestions"
            elif val == "DEEP_DIVE:":
                current_section = "deep_dive"
            elif val and current_section:
                if current_section == "strengths":
                    result["strengths"] = [s.strip("- ").strip() for s in val.split("\n") if s.strip()]
                elif current_section == "missing":
                    result["missing"] = [s.strip("- ").strip() for s in val.split("\n") if s.strip()]
                elif current_section == "suggestions":
                    parts = val.split("TYPE:")
                    for part in parts:
                        if "CONTENT:" in part:
                            t = part.split("CONTENT:")[0].strip()
                            c = part.split("CONTENT:")[1].split("TYPE:")[0].strip()
                            result["suggestions"].append({"type": t, "content": c})
                elif current_section == "deep_dive":
                    result["deep_dive"] = val
                    
        return result
    except Exception as e:
        print(f"Gemini Advanced Analysis Error: {e}")
        return {}


def generate_feedback(transcript: str, reference_answer: str, score: float) -> dict:
    """
    Generate structured AI feedback by comparing the transcript against the reference.
    Uses keyword extraction for baseline and Gemini for advanced sentence-based feedback.
    """
    if not transcript or not transcript.strip():
        return {
            "strengths": [],
            "missing": [],
            "suggestion": "No speech detected.",
            "suggestions": [],
            "deep_dive": "No data for deep dive."
        }

    ref_keywords = _extract_keywords(reference_answer, top_n=10)
    
    # Keyword-based baseline detection
    strengths_kw = [kw for kw in ref_keywords if _keyword_present(kw, transcript)]
    missing_kw = [kw for kw in ref_keywords if kw not in strengths_kw]

    # Priority 1: OpenAI
    analysis = _get_openai_analysis(transcript, reference_answer, score, missing_kw[:5], strengths_kw[:5])
    
    # Priority 2: Gemini Fallback
    if not analysis:
        analysis = _get_gemini_advanced_analysis(transcript, reference_answer, score, missing_kw[:5], strengths_kw[:5])
    
    if analysis:
        return {
            "strengths": analysis.get("strengths", [kw.capitalize() for kw in strengths_kw[:5]]),
            "missing": analysis.get("missing", [kw.capitalize() for kw in missing_kw[:5]]),
            "suggestions": analysis.get("suggestions", []),
            "suggestion": analysis.get("suggestions", [{}])[0].get("content", "Improve your response."),
            "deep_dive": analysis.get("deep_dive", "Comprehensive analysis complete.")
        }
    else:
        # Fallback
        return {
            "strengths": [f"You correctly addressed {kw}." for kw in strengths_kw[:3]],
            "missing": [f"You missed discussing {kw}." for kw in missing_kw[:3]],
            "suggestions": [{"type": "General", "content": "Review the reference answer."}],
            "suggestion": "Review the reference answer.",
            "deep_dive": "Fallback analysis."
        }
