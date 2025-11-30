import React, { useState, useEffect } from 'react';
import { 
  Briefcase, Upload, User, Search, CheckCircle, XCircle, 
  LogOut, Building2, MapPin, DollarSign, Clock, Cpu, Plus, X, Video, Loader2, Trash2
} from 'lucide-react';
import axios from 'axios';
import InterviewSession from './components/InterviewSession';

// --- CONFIGURATION ---
const API_BASE = 'https://smart-hire-ujyg.onrender.com/api';

// --- COMPONENTS ---
const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type='button' }) => {
  const baseStyle = "px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95";
  const variants = {
    primary: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/30 border border-transparent",
    secondary: "bg-white/10 text-white backdrop-blur-sm border border-white/20 hover:bg-white/20",
    danger: "bg-gradient-to-r from-red-500 to-rose-600 text-white hover:shadow-lg hover:shadow-red-500/30",
    success: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg hover:shadow-emerald-500/30"
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>{children}</button>;
};

const Card = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, color = 'blue' }) => {
  const colors = {
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    green: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    red: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  };
  return <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colors[color]}`}>{children}</span>;
};

// --- MAIN APP ---

export default function App() {
  const [view, setView] = useState('auth'); 
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(false);
  
  // Auth State
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('student');

  // Dashboard Data
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [domains, setDomains] = useState([]);
  
  // Create Job State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newJob, setNewJob] = useState({
    title: '', domain: '', desc: '', location: '', salary: '', deadline: '',
    min10: 60, min12: 60, minBtech: 65, skills: ''
  });

  // --- AUTH ACTIONS ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin 
        ? { email, password }
        : { email, password, full_name: fullName, role, phone: '' };
      
      const res = await axios.post(`${API_BASE}${endpoint}`, payload);
      
      if (res.data.access_token) {
        const t = res.data.access_token;
        const r = res.data.role;
        setToken(t);
        localStorage.setItem('token', t);
        
        if (!isLogin && r === 'recruiter') {
          await axios.put(`${API_BASE}/recruiter/profile`, 
            { company_name: companyName },
            { headers: { Authorization: `Bearer ${t}` }}
          );
        }
        setView(r === 'recruiter' ? 'recruiter' : 'student');
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Authentication failed');
    }
    setIsLoading(false);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('token');
    setView('auth');
  };

  // --- DATA FETCHING ---
  useEffect(() => {
    if (token && view !== 'interview') fetchDashboardData();
  }, [token, view]);

  const fetchDashboardData = async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    try {
      if(domains.length === 0) {
         const domRes = await axios.get(`${API_BASE}/student/domains`);
         setDomains(domRes.data.domains || []);
      }

      if (view === 'recruiter') {
        const res = await axios.get(`${API_BASE}/recruiter/jobs`, { headers });
        setJobs(res.data.jobs);
      } else if (view === 'student') {
        const res = await axios.get(`${API_BASE}/student/jobs`, { headers });
        setJobs(res.data.jobs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- RECRUITER ACTIONS ---
  const handleCreateJob = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = {
        job: {
          domain_id: parseInt(newJob.domain),
          job_title: newJob.title,
          job_description: newJob.desc,
          job_type: "full-time",
          location: newJob.location,
          salary_range: newJob.salary,
          application_deadline: newJob.deadline
        },
        criteria: {
          min_10th_percentage: parseFloat(newJob.min10),
          min_12th_percentage: parseFloat(newJob.min12),
          min_btech_percentage: parseFloat(newJob.minBtech),
          required_skills: newJob.skills.split(',').map(s => s.trim()),
          min_certifications: 1
        }
      };

      await axios.post(`${API_BASE}/recruiter/jobs`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert("Job Posted Successfully!");
      setShowCreateModal(false);
      fetchDashboardData();
      setNewJob({ title: '', domain: '', desc: '', location: '', salary: '', deadline: '', min10: 60, min12: 60, minBtech: 65, skills: '' });
    } catch (err) {
      alert("Failed to create job");
    }
    setIsLoading(false);
  };

  const handleAutoShortlist = async (jobId) => {
    if(!confirm("Start AI Analysis? This may take a moment.")) return;
    setIsLoading(true);
    try {
      await axios.post(`${API_BASE}/recruiter/jobs/${jobId}/auto-shortlist`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("AI Analysis Complete!");
      fetchDashboardData();
      viewApplications(jobId); 
    } catch (err) {
      alert("Analysis failed");
    }
    setIsLoading(false);
  };

  const viewApplications = async (jobId) => {
    try {
      const res = await axios.get(`${API_BASE}/recruiter/jobs/${jobId}/applications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApplications(res.data.applications);
    } catch (err) {
      console.error(err);
    }
  };

  // --- NEW: DELETE APPLICATION FUNCTION ---
  const handleDeleteApplication = async (appId, e) => {
    e.stopPropagation(); // Prevent clicking the card
    if (!confirm("Are you sure you want to delete this candidate?")) return;
    
    try {
        await axios.delete(`${API_BASE}/recruiter/applications/${appId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        // Remove from UI immediately
        setApplications(prev => prev.filter(app => app.application_id !== appId));
    } catch (err) {
        alert("Failed to delete application");
    }
  };

  // --- STUDENT ACTIONS ---
  const handleApply = async (jobId, file, domainId) => {
    if (!file) return;
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('domain_id', domainId);
      
      const uploadRes = await axios.post(`${API_BASE}/student/resume/upload`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });

      await axios.post(
        `${API_BASE}/student/apply/${jobId}?resume_id=${uploadRes.data.resume_id}`, 
        {}, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert("Application Sent! The recruiter will review your profile soon.");
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.detail || "Application failed");
    }
    setIsLoading(false);
  };

  // --- RENDERERS ---

  if (view === 'interview') {
    return <InterviewSession token={token} onBack={() => setView('student')} />;
  }

  if (view === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        
        <Card className="w-full max-w-md relative z-10 border-white/20">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
              <Cpu className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">SmartHire AI</h1>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <input type="email" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <input type="password" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>

            {!isLogin && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div onClick={() => setRole('student')} className={`cursor-pointer p-3 rounded-xl border text-center ${role === 'student' ? 'bg-blue-500/20 border-blue-500' : 'bg-white/5 border-white/10'}`}>
                    <User className="w-6 h-6 mx-auto mb-1" /> <span className="text-sm">Student</span>
                  </div>
                  <div onClick={() => setRole('recruiter')} className={`cursor-pointer p-3 rounded-xl border text-center ${role === 'recruiter' ? 'bg-purple-500/20 border-purple-500' : 'bg-white/5 border-white/10'}`}>
                    <Briefcase className="w-6 h-6 mx-auto mb-1" /> <span className="text-sm">Recruiter</span>
                  </div>
                </div>
                <input type="text" placeholder="Full Name" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none" value={fullName} onChange={e => setFullName(e.target.value)} />
                {role === 'recruiter' && (
                  <input type="text" placeholder="Company Name" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                )}
              </>
            )}

            <Button type="submit" className="w-full mt-6" disabled={isLoading}>
              {isLoading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
            </Button>
            <div className="text-center mt-4">
              <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-sm text-gray-400 hover:text-white">{isLogin ? "Register Account" : "Back to Login"}</button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // --- RECRUITER DASHBOARD ---
  if (view === 'recruiter') {
    return (
      <div className="min-h-screen bg-[#0f172a] p-8">
        <nav className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Briefcase className="text-white" />
            </div>
            <h1 className="text-2xl font-bold">Recruiter Portal</h1>
          </div>
          <Button variant="secondary" onClick={logout}><LogOut className="w-4 h-4" /> Logout</Button>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Active Jobs</h2>
              <Button variant="primary" className="px-3 py-1.5 text-sm" onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4" /> New Job
              </Button>
            </div>
            
            <div className="space-y-4 h-[600px] overflow-y-auto pr-2">
              {jobs.map(job => (
                <Card key={job.job_id} className="group hover:border-blue-500/50 cursor-pointer transition-all">
                  <div onClick={() => viewApplications(job.job_id)}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg group-hover:text-blue-400">{job.job_title}</h3>
                      <Badge color="blue">{job.status}</Badge>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">{job.location} • {job.total_applications} Applicants</p>
                    <Button variant="secondary" className="w-full py-2 text-sm" onClick={(e) => { e.stopPropagation(); handleAutoShortlist(job.job_id); }} disabled={isLoading}>
                      {isLoading ? 'Processing...' : '✨ AI Shortlist'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Candidate Analysis</h2>
              {applications.length > 0 && <Badge color="purple">{applications.length} Candidates</Badge>}
            </div>

            <div className="space-y-4 h-[600px] overflow-y-auto pr-2">
              {applications.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
                  <Search className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">Select a job to view candidates</p>
                </div>
              ) : (
                applications.map(app => (
                  <Card key={app.application_id} className="relative overflow-hidden group">
                    <div className="absolute top-0 right-0 px-4 py-2 bg-white/5 border-b border-l border-white/10 rounded-bl-2xl">
                      <span className="text-xs text-gray-400 mr-2">SCORE</span>
                      <span className={`text-lg font-bold ${app.overall_score > 70 ? 'text-emerald-400' : 'text-orange-400'}`}>{app.overall_score}</span>
                    </div>
                    
                    {/* DELETE BUTTON */}
                    <button onClick={(e) => handleDeleteApplication(app.application_id, e)} className="absolute bottom-4 right-4 p-2 bg-red-500/10 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20">
                        <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xl">{app.full_name[0]}</div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          {app.full_name}
                          {app.application_status === 'shortlisted' ? <Badge color="green">Shortlisted</Badge> : <Badge color="red">Rejected</Badge>}
                        </h3>
                        <p className="text-sm text-gray-400 mb-3">{app.email}</p>
                        <div className="grid grid-cols-3 gap-2 mb-3 bg-white/5 p-2 rounded-lg text-xs">
                          <div>B.Tech: <span className="text-blue-300">{app.btech_percentage}%</span></div>
                          <div>12th: <span className="text-blue-300">{app.twelfth_percentage}%</span></div>
                          <div>Skills: <span className="text-blue-300">{app.skills?.length || 0}</span></div>
                        </div>
                        {app.rejection_reasons?.length > 0 && (
                          <div className="text-xs text-rose-300 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                             ⚠️ {app.rejection_reasons.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>

        {/* CREATE JOB MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#1e293b] w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Post New Job</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white"><X /></button>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <form onSubmit={handleCreateJob} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-400">Job Title</label>
                      <input type="text" required className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500" value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Domain</label>
                      <select required className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500" value={newJob.domain} onChange={e => setNewJob({...newJob, domain: e.target.value})}>
                        <option value="">Select Domain</option>
                        {domains.map(d => <option key={d.domain_id} value={d.domain_id}>{d.domain_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Location</label>
                      <input type="text" required className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500" value={newJob.location} onChange={e => setNewJob({...newJob, location: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Salary Range</label>
                      <input type="text" placeholder="e.g. 10-15 LPA" className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500" value={newJob.salary} onChange={e => setNewJob({...newJob, salary: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Deadline</label>
                      <input type="date" required className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500" value={newJob.deadline} onChange={e => setNewJob({...newJob, deadline: e.target.value})} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-400">Description</label>
                      <textarea rows="3" className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500" value={newJob.desc} onChange={e => setNewJob({...newJob, desc: e.target.value})}></textarea>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-sm font-semibold mb-3 text-blue-400">Eligibility Criteria</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                         <label className="text-xs text-gray-400">Min 10th %</label>
                         <input type="number" className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white outline-none" value={newJob.min10} onChange={e => setNewJob({...newJob, min10: e.target.value})} />
                      </div>
                      <div>
                         <label className="text-xs text-gray-400">Min 12th %</label>
                         <input type="number" className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white outline-none" value={newJob.min12} onChange={e => setNewJob({...newJob, min12: e.target.value})} />
                      </div>
                      <div>
                         <label className="text-xs text-gray-400">Min B.Tech %</label>
                         <input type="number" className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white outline-none" value={newJob.minBtech} onChange={e => setNewJob({...newJob, minBtech: e.target.value})} />
                      </div>
                      <div className="col-span-3">
                         <label className="text-xs text-gray-400">Required Skills (Comma separated)</label>
                         <input type="text" placeholder="Python, Java, SQL" className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white outline-none" value={newJob.skills} onChange={e => setNewJob({...newJob, skills: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end gap-3">
                    <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                    <Button type="submit">Post Job</Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- STUDENT DASHBOARD ---
  if (view === 'student') {
    return (
      <div className="min-h-screen bg-[#0f172a] p-8">
         <nav className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
              <User className="text-white" />
            </div>
            <h1 className="text-2xl font-bold">Student Portal</h1>
          </div>
          <Button variant="secondary" onClick={logout}><LogOut className="w-4 h-4" /> Logout</Button>
        </nav>

        {/* AI INTERVIEW BUTTON */}
        <div className="max-w-5xl mx-auto mb-8">
            <Card className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border-blue-500/30 cursor-pointer hover:border-blue-400 transition-all group" onClick={() => setView('interview')}>
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/50 group-hover:scale-110 transition-transform">
                        <Video className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Start AI Mock Interview</h2>
                        <p className="text-blue-200">Practice domain-specific questions with real-time AI feedback.</p>
                    </div>
                    <div className="ml-auto">
                        <Button>Launch Session</Button>
                    </div>
                </div>
            </Card>
        </div>

        {/* JOB LIST WITH RESUME UPLOAD */}
        <div className="max-w-5xl mx-auto grid gap-6">
          <h3 className="text-xl font-bold text-gray-400">Available Jobs</h3>
          {jobs.length === 0 ? <p className="text-gray-500">No active jobs found.</p> : null}
          {jobs.map(job => (
            <Card key={job.job_id}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold">{job.job_title}</h3>
                    <Badge color="purple">{job.domain_name}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                    <span className="flex items-center gap-1"><Building2 className="w-4 h-4" /> {job.company_name}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {job.location}</span>
                    <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" /> {job.salary_range}</span>
                  </div>
                  <p className="text-gray-400 text-sm line-clamp-2">{job.job_description}</p>
                </div>
                <div className="min-w-[200px] bg-white/5 p-4 rounded-xl border border-white/10">
                  <p className="text-sm font-medium mb-3 text-center">Quick Apply</p>
                  <div className="relative group">
                    <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept=".pdf,.docx" onChange={(e) => handleApply(job.job_id, e.target.files[0], job.domain_id)} />
                    <div className="border-2 border-dashed border-blue-500/30 rounded-lg p-4 text-center group-hover:border-blue-500 group-hover:bg-blue-500/10 transition-all">
                      <Upload className="w-6 h-6 mx-auto text-blue-400 mb-2" />
                      <span className="text-xs text-blue-300">Drop Resume (PDF)</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  return null;
}