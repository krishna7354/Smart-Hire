# =====================================================
# SMART RECRUITMENT (ONLINE DB VERSION) - BACKEND
# File: backend/main.py
# =====================================================

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, status, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
import mysql.connector
from mysql.connector import Error, pooling
import bcrypt
import jwt
from datetime import datetime, timedelta
import json
import os
import shutil
from pathlib import Path

# AI Libraries
import google.generativeai as genai
import PyPDF2
import docx

import os
from dotenv import load_dotenv # Import this

load_dotenv() # Load local .env file if it exists
# =====================================================
# CONFIGURATION
# =====================================================

class Config:
    # --- ONLINE DATABASE CREDENTIALS ---
    # FILL THESE IN FROM YOUR HOSTING EMAIL
    DB_HOST = 'sql12.freesqldatabase.com' # Example host, check your email!
    DB_USER = 'sql12809679'               # Your DB Username (usually same as DB name)
    DB_PASSWORD = '2pj28Hlfnc' # <--- PASTE PASSWORD HERE
    DB_NAME = 'sql12809679'               # Your specific DB Name
    DB_PORT = 3306                        # Standard MySQL port
    
    # JWT Config
    SECRET_KEY = 'your-super-secret-key-change-in-production-12345'
    ALGORITHM = 'HS256'
    ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 
    
    # Gemini API
    #GEMINI_API_KEY = 'AIzaSyCNhVjAS0WGGCJUtkJzAo_0Y7Kv7gHJ2S0'
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    # File Upload
    UPLOAD_DIR = './uploads/resumes'
    MAX_FILE_SIZE = 5 * 1024 * 1024 

Path(Config.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

# =====================================================
# DATABASE POOL
# =====================================================

# Reduced pool size to 3 because free online hosts have strict connection limits
db_pool = pooling.MySQLConnectionPool(
    pool_name="recruitment_pool",
    pool_size=3, 
    pool_reset_session=True,
    host=Config.DB_HOST,
    user=Config.DB_USER,
    password=Config.DB_PASSWORD,
    database=Config.DB_NAME,
    port=Config.DB_PORT
)

def get_db_connection():
    try:
        return db_pool.get_connection()
    except Error as e:
        print(f"DB Error: {e}")
        raise HTTPException(status_code=500, detail=f"Database connection failed. Check Credentials.")

# =====================================================
# GEMINI SERVICE
# =====================================================

genai.configure(api_key=Config.GEMINI_API_KEY)

class GeminiService:
    def __init__(self):
        # Priority list of models to try
        self.models = [
            'gemini-1.5-flash', 
            'gemini-1.5-pro',
            'gemini-pro'
        ]

    def generate(self, prompt: str):
        last_error = None
        # Try each model until one works
        for model_name in self.models:
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                return response.text
            except Exception as e:
                print(f"Model {model_name} failed: {e}")
                last_error = e
                continue
        raise last_error # If all fail, raise error to trigger fallback questions

    def parse_resume_text(self, text: str):
        prompt = f"""
        Extract structured data from this resume:
        {text}
        Return ONLY valid JSON (no markdown):
        {{
            "name": "string",
            "email": "string",
            "phone": "string",
            "tenth_percentage": float or null,
            "twelfth_percentage": float or null,
            "btech_percentage": float or null,
            "skills": ["skill1", "skill2"],
            "certifications": ["cert1", "cert2"],
            "career_objective": "string",
            "objective_score": float
        }}
        """
        response = self.generate(prompt)
        # Clean potential markdown
        clean_json = response.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_json)

ai_service = GeminiService()

def extract_text(file_path: str):
    text = ""
    try:
        if file_path.endswith('.pdf'):
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages: text += page.extract_text()
        elif file_path.endswith('.docx'):
            doc = docx.Document(file_path)
            for para in doc.paragraphs: text += para.text + "\n"
    except Exception as e:
        print(f"File read error: {e}")
    return text

# =====================================================
# DATA MODELS
# =====================================================

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    role: str
    full_name: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_id: int

class RecruiterProfile(BaseModel):
    company_name: str
    company_website: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None

class JobPosting(BaseModel):
    domain_id: int
    job_title: str
    job_description: Optional[str] = None
    job_type: str
    location: str
    work_mode: str = 'on-site'
    salary_range: Optional[str] = None
    application_deadline: Optional[str] = None

class RecruiterCriteria(BaseModel):
    min_10th_percentage: float = 0.0
    min_12th_percentage: float = 0.0
    min_btech_percentage: float = 0.0
    required_skills: List[str] = []
    min_certifications: int = 0
    evaluate_career_objective: bool = True
    min_objective_score: float = 5.0

class JobWithCriteria(BaseModel):
    job: JobPosting
    criteria: RecruiterCriteria

class InterviewRequest(BaseModel):
    domain: str
    difficulty: str
    skills: str

# =====================================================
# SECURITY
# =====================================================

security = HTTPBearer()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=Config.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, Config.SECRET_KEY, algorithm=Config.ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, Config.SECRET_KEY, algorithms=[Config.ALGORITHM])
        return payload
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

# =====================================================
# API ROUTES
# =====================================================

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- AUTH ---
@app.post("/api/auth/register", response_model=Token)
async def register(user: UserRegister):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT user_id FROM users WHERE email = %s", (user.email,))
        if cursor.fetchone(): raise HTTPException(status_code=400, detail="Email exists")
        
        cursor.execute("INSERT INTO users (email, password_hash, role, full_name, phone) VALUES (%s, %s, %s, %s, %s)",
                       (user.email, hash_password(user.password), user.role, user.full_name, user.phone))
        uid = cursor.lastrowid
        
        if user.role == 'student': cursor.execute("INSERT INTO students (user_id) VALUES (%s)", (uid,))
        else: cursor.execute("INSERT INTO recruiters (user_id, company_name) VALUES (%s, 'Not Set')", (uid,))
        
        conn.commit()
        return Token(access_token=create_access_token({"user_id": uid, "role": user.role}), token_type="bearer", role=user.role, user_id=uid)
    except Error as e: conn.rollback(); raise HTTPException(status_code=500, detail=str(e))
    finally: cursor.close(); conn.close()

@app.post("/api/auth/login", response_model=Token)
async def login(user: UserLogin):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT user_id, password_hash, role FROM users WHERE email = %s", (user.email,))
        u = cursor.fetchone()
        if not u or not verify_password(user.password, u['password_hash']): raise HTTPException(status_code=401, detail="Invalid login")
        return Token(access_token=create_access_token({"user_id": u['user_id'], "role": u['role']}), token_type="bearer", role=u['role'], user_id=u['user_id'])
    finally: cursor.close(); conn.close()

# --- RECRUITER ---
@app.put("/api/recruiter/profile")
async def update_profile(p: RecruiterProfile, u: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE recruiters SET company_name=%s, company_website=%s, industry=%s, company_size=%s WHERE user_id=%s",
                   (p.company_name, p.company_website, p.industry, p.company_size, u['user_id']))
    conn.commit()
    conn.close()
    return {"message": "Updated"}

@app.post("/api/recruiter/jobs")
async def create_job(data: JobWithCriteria, u: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT recruiter_id FROM recruiters WHERE user_id=%s", (u['user_id'],))
        rid = cursor.fetchone()[0]
        cursor.execute("INSERT INTO job_postings (recruiter_id, domain_id, job_title, job_description, job_type, location, salary_range, application_deadline, status) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'active')",
                       (rid, data.job.domain_id, data.job.job_title, data.job.job_description, data.job.job_type, data.job.location, data.job.salary_range, data.job.application_deadline))
        jid = cursor.lastrowid
        cursor.execute("INSERT INTO recruiter_criteria (job_id, min_10th_percentage, min_12th_percentage, min_btech_percentage, required_skills, min_certifications, evaluate_career_objective, min_objective_score) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                       (jid, data.criteria.min_10th_percentage, data.criteria.min_12th_percentage, data.criteria.min_btech_percentage, json.dumps(data.criteria.required_skills), data.criteria.min_certifications, data.criteria.evaluate_career_objective, data.criteria.min_objective_score))
        conn.commit()
        return {"message": "Job Created"}
    finally: cursor.close(); conn.close()

@app.get("/api/recruiter/jobs")
async def get_jobs(u: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT recruiter_id FROM recruiters WHERE user_id=%s", (u['user_id'],))
    rid = cursor.fetchone()['recruiter_id']
    cursor.execute("""SELECT jp.*, jd.domain_name, 
                      (SELECT COUNT(*) FROM job_applications WHERE job_id = jp.job_id) as total_applications
                      FROM job_postings jp JOIN job_domains jd ON jp.domain_id = jd.domain_id 
                      WHERE jp.recruiter_id = %s ORDER BY jp.created_at DESC""", (rid,))
    jobs = cursor.fetchall()
    conn.close()
    return {"jobs": jobs}

@app.get("/api/recruiter/jobs/{job_id}/applications")
async def get_apps(job_id: int, u: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""SELECT ja.*, u.full_name, u.email, r.btech_percentage, r.skills, r.objective_score
                      FROM job_applications ja JOIN students s ON ja.student_id = s.student_id
                      JOIN users u ON s.user_id = u.user_id JOIN resumes r ON ja.resume_id = r.resume_id
                      WHERE ja.job_id = %s ORDER BY ja.overall_score DESC""", (job_id,))
    apps = cursor.fetchall()
    conn.close()
    for a in apps: 
        if a['skills']: a['skills'] = json.loads(a['skills'])
        if a['rejection_reasons']: a['rejection_reasons'] = json.loads(a['rejection_reasons'])
    return {"applications": apps}

@app.post("/api/recruiter/jobs/{job_id}/auto-shortlist")
async def auto_shortlist(job_id: int, u: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT r.resume_id, r.file_path FROM job_applications ja JOIN resumes r ON ja.resume_id = r.resume_id WHERE ja.job_id = %s AND r.parsing_status = 'pending'", (job_id,))
        pending = cursor.fetchall()
        for res in pending:
            try:
                text = extract_text(res['file_path'])
                data = ai_service.parse_resume_text(text)
                cursor.execute("""UPDATE resumes SET parsed_name=%s, parsed_email=%s, parsed_phone=%s, tenth_percentage=%s, 
                               twelfth_percentage=%s, btech_percentage=%s, skills=%s, certifications=%s, career_objective=%s, 
                               objective_score=%s, parsing_status='completed' WHERE resume_id=%s""",
                               (data.get('name'), data.get('email'), data.get('phone'), data.get('tenth_percentage'),
                                data.get('twelfth_percentage'), data.get('btech_percentage'), json.dumps(data.get('skills', [])),
                                json.dumps(data.get('certifications', [])), data.get('career_objective'), data.get('objective_score'), res['resume_id']))
                conn.commit()
            except Exception as e: print(f"Parse error {res['resume_id']}: {e}")
        
        cursor.execute("CALL auto_shortlist_candidates(%s)", (job_id,))
        conn.commit()
        return {"message": "Shortlisting complete"}
    finally: cursor.close(); conn.close()

# --- STUDENT ---
@app.get("/api/student/domains")
async def get_domains():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM job_domains WHERE is_active = TRUE")
    d = cursor.fetchall()
    conn.close()
    return {"domains": d}

@app.post("/api/student/resume/upload")
async def upload(file: UploadFile = File(...), domain_id: int = Form(...), u: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT student_id FROM students WHERE user_id = %s", (u['user_id'],))
        sid = cursor.fetchone()['student_id']
        fname = f"{sid}_{datetime.now().timestamp()}.{file.filename.split('.')[-1]}"
        fpath = os.path.join(Config.UPLOAD_DIR, fname)
        with open(fpath, "wb") as b: shutil.copyfileobj(file.file, b)
        cursor.execute("INSERT INTO resumes (student_id, domain_id, original_filename, file_path, parsing_status, upload_date) VALUES (%s, %s, %s, %s, 'pending', NOW())", (sid, domain_id, file.filename, fpath))
        rid = cursor.lastrowid
        conn.commit()
        return {"resume_id": rid}
    finally: cursor.close(); conn.close()

@app.get("/api/student/jobs")
async def get_avail_jobs(u: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""SELECT jp.*, jd.domain_name, r.company_name FROM job_postings jp 
                      JOIN job_domains jd ON jp.domain_id = jd.domain_id 
                      JOIN recruiters r ON jp.recruiter_id = r.recruiter_id 
                      WHERE jp.status = 'active' ORDER BY jp.created_at DESC""")
    jobs = cursor.fetchall()
    conn.close()
    return {"jobs": jobs}

@app.post("/api/student/apply/{job_id}")
async def apply(job_id: int, resume_id: int, u: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT student_id FROM students WHERE user_id = %s", (u['user_id'],))
        sid = cursor.fetchone()['student_id']
        cursor.execute("INSERT INTO job_applications (job_id, student_id, resume_id, application_status, overall_score, applied_at) VALUES (%s, %s, %s, 'applied', 0, NOW())", (job_id, sid, resume_id))
        conn.commit()
        return {"message": "Applied"}
    except: raise HTTPException(status_code=400, detail="Already applied")
    finally: cursor.close(); conn.close()

# --- INTERVIEW ROUTES ---

@app.post("/api/interview/generate-questions")
async def generate_questions(req: InterviewRequest, u: dict = Depends(get_current_user)):
    prompt = f"""
    Generate 5 technical interview questions for a {req.domain} role ({req.difficulty} level).
    Candidate skills: {req.skills}
    Return output strictly as a JSON array (no markdown).
    Example: [{{"id": 1, "question": "Explain React hooks.", "focus": "React"}}]
    """
    try:
        response = ai_service.generate(prompt)
        return json.loads(response.replace("```json", "").replace("```", "").strip())
    except:
        return [
            {"id": 1, "question": "Tell me about yourself.", "focus": "Intro"},
            {"id": 2, "question": "What are your greatest strengths?", "focus": "Behavioral"},
            {"id": 3, "question": "Describe a difficult project you worked on.", "focus": "Experience"}
        ]

@app.post("/api/interview/evaluate")
async def evaluate_answer(
    question: str = Form(...),
    transcript: str = Form(...),
    audio: UploadFile = File(...),
    u: dict = Depends(get_current_user)
):
    prompt = f"""
    Evaluate this answer. Question: {question}. Answer: {transcript}.
    Return ONLY raw JSON: {{ "score": 85, "feedback": "One sentence feedback." }}
    """
    try:
        response = ai_service.generate(prompt)
        result = json.loads(response.replace("```json", "").replace("```", "").strip())
    except:
        result = {"score": 70, "feedback": "Good effort. Keep practicing!"}

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT student_id FROM students WHERE user_id = %s", (u['user_id'],))
        sid = cursor.fetchone()[0]
        cursor.execute("INSERT INTO mock_interviews (student_id, domain_name, question_text, answer_transcript, ai_score, ai_feedback) VALUES (%s, %s, %s, %s, %s, %s)",
                       (sid, "General", question, transcript, result['score'], result['feedback']))
        conn.commit()
    finally: cursor.close(); conn.close()
    
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)