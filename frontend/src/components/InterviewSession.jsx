import React, { useState, useRef, useEffect } from 'react';
import { Mic, Video, Play, Square, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import axios from 'axios';

// IMPORTANT: Using the same port as SmartHire backend
// Add /interview to the end so it hits the correct backend group
const API_BASE = 'https://smart-hire-ujyg.onrender.com/api/interview';

const Card = ({ children, className = '' }) => (
  <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', disabled = false, className='' }) => {
  const baseStyle = "px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95";
  const variants = {
    primary: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/30",
    danger: "bg-gradient-to-r from-red-500 to-rose-600 text-white hover:shadow-lg hover:shadow-red-500/30",
    secondary: "bg-white/10 text-white hover:bg-white/20 border border-white/10"
  };
  return <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>{children}</button>;
};

export default function InterviewSession({ token, onBack }) {
  const [step, setStep] = useState('setup');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({ domain: 'Python Developer', difficulty: 'Intermediate', skills: '' });
  
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState([]);
  
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processingAnswer, setProcessingAnswer] = useState(false);
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    if (step === 'interview' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [step]);

  const startInterview = async () => {
    setLoading(true);
    try {
      // Pass JWT token in headers
      const res = await axios.post(`${API_BASE}/generate-questions`, config, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuestions(res.data);
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream; 
      
      if ('webkitSpeechRecognition' in window) {
        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) interim += event.results[i][0].transcript;
          setTranscript(prev => interim); 
          transcriptRef.current = interim;
        };
        recognitionRef.current = recognition;
      }
      setStep('interview');
    } catch (err) {
      alert("Error starting interview: " + (err.response?.data?.detail || err.message));
    }
    setLoading(false);
  };

  const startRecording = () => {
    setIsRecording(true);
    setTranscript('');
    transcriptRef.current = '';
    chunksRef.current = [];
    const stream = streamRef.current;
    if (!stream) return alert("No camera stream!");

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      handleAnswerSubmission(blob);
    };
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    if (recognitionRef.current) recognitionRef.current.start();
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  const handleAnswerSubmission = async (audioBlob) => {
    setProcessingAnswer(true);
    try {
      const currentQ = questions[currentIndex];
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('question', currentQ.question);
      const finalTranscript = transcriptRef.current || "No transcript captured"; 
      formData.append('transcript', finalTranscript);

      const res = await axios.post(`${API_BASE}/evaluate`, formData, {
        headers: { 
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
        }
      });

      setHistory([...history, {
        question: currentQ.question,
        transcript: finalTranscript,
        score: res.data.score,
        feedback: res.data.feedback
      }]);

      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setTranscript('');
        transcriptRef.current = '';
      } else {
        if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
        setStep('report');
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit answer");
    }
    setProcessingAnswer(false);
  };

  // --- RENDERS ---
  if (step === 'setup') {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Button variant="secondary" onClick={onBack} className="mb-6"><ArrowLeft className="w-4 h-4" /> Back to Dashboard</Button>
        <Card>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">Mock Interview Setup</h1>
            <p className="text-gray-400">Configure your session</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">Target Role</label>
              <input type="text" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white" 
                value={config.domain} onChange={e => setConfig({...config, domain: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-400">Difficulty</label>
              <select className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white"
                value={config.difficulty} onChange={e => setConfig({...config, difficulty: e.target.value})}>
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400">Key Skills</label>
              <textarea className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white" rows="2"
                value={config.skills} onChange={e => setConfig({...config, skills: e.target.value})} placeholder="Python, SQL..." />
            </div>
            <Button onClick={startInterview} disabled={loading} className="w-full mt-4">
              {loading ? <Loader2 className="animate-spin" /> : <><Play className="w-4 h-4" /> Start Interview</>}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (step === 'interview') {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card className="border-l-4 border-l-blue-500">
              <h3 className="text-xl font-bold mb-2">Question {currentIndex + 1}</h3>
              <p className="text-2xl font-medium">{questions[currentIndex]?.question}</p>
            </Card>
            <Card className="h-[300px] overflow-y-auto">
              <p className="text-gray-300 whitespace-pre-wrap">{transcript || "Speak to see transcript..."}</p>
            </Card>
          </div>
          <div className="space-y-6">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
              <video ref={videoRef} autoPlay muted className="w-full h-full object-cover transform scale-x-[-1]" />
              {processingAnswer && <div className="absolute inset-0 bg-black/80 flex items-center justify-center"><Loader2 className="w-12 h-12 text-blue-500 animate-spin" /></div>}
            </div>
            <div className="grid grid-cols-1">
              {!isRecording ? 
                <Button onClick={startRecording} disabled={processingAnswer}><Mic className="w-6 h-6" /> Start Answer</Button> :
                <Button onClick={stopRecording} variant="danger"><Square className="w-6 h-6" /> Stop & Submit</Button>
              }
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-center">Analysis Report</h1>
      <div className="grid gap-6">
        {history.map((item, idx) => (
          <Card key={idx}>
            <div className="flex justify-between mb-2">
              <h3 className="font-bold text-lg">{item.question}</h3>
              <span className={`px-3 py-1 rounded-full ${item.score >= 80 ? 'bg-green-500/20 text-green-300' : 'bg-orange-500/20 text-orange-300'}`}>{item.score}/100</span>
            </div>
            <p className="text-sm text-gray-400 mb-2">Your Answer: {item.transcript}</p>
            <div className="flex gap-2 items-start text-blue-300">
              <CheckCircle className="w-4 h-4 mt-1" />
              <p className="text-sm">{item.feedback}</p>
            </div>
          </Card>
        ))}
      </div>
      <div className="flex justify-center mt-8 gap-4">
        <Button onClick={onBack} variant="secondary">Back to Dashboard</Button>
      </div>
    </div>
  );
}