import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Play, Pause, RotateCcw, CheckCircle2, Settings, Plus, Trash2, ArrowLeft, Lock, Trophy, Zap, Calendar, 
  ChevronDown, ChevronUp, Star, Award, Medal, Crown, Gift, Sparkles, Heart, Rocket, Archive, History, 
  Box, ThumbsUp, FastForward, Save, FolderOpen, User, ImageIcon, BarChart3, MessageCircleHeart, X, RefreshCw 
} from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";

// --- Types & Constants ---
type MissionStatus = 'pending' | 'active' | 'completed';
type StickerType = 'medal' | 'star' | 'heart' | 'rocket' | 'crown';
interface Mission { id: string; title: string; durationMinutes: number; reward: string; status: MissionStatus; createdAt: number; completedAt?: number; }
interface RewardStep { stickers: number; text: string; }
interface RewardConfig { type: 'currency' | 'text'; steps: RewardStep[]; }
interface MissionPreset { id: string; name: string; missions: Omit<Mission, 'id' | 'status' | 'createdAt' | 'completedAt'>[]; }
interface StickerDay { date: string; count: number; isBonusUsed?: boolean; stickerType?: StickerType; }
interface MissionLog { date: string; title: string; }
interface ChildProfile { name: string; photo: string | null; }
interface ArchiveEntry { monthId: string; stickers: StickerDay[]; totalStickers: number; archivedAt: number; }

const MISSIONS_KEY = 'mm_missions';
const STICKERS_KEY = 'mm_stickers';
const BONUS_STICKERS_KEY = 'mm_bonus';
const ARCHIVES_KEY = 'mm_archives';
const PROFILE_KEY = 'mm_profile';
const REWARD_CONFIG_KEY = 'mm_reward';
const MISSION_LOG_KEY = 'mm_logs';
const PIN_KEY = 'mm_pin';
const DEFAULT_PIN = '1234';

const encouragingPhrases = ["대단해! 멋지게 해냈구나?", "정말 잘했어! 굉장한걸?", "오늘 정말 최고야! ✨", "우와, 미션 클리어! 🏆", "역시 넌 할 수 있을 줄 알았어!", "너의 노력이 정말 멋져! 💖", "최고야! 다음 단계로 가보자! 🚀"];

// --- Utils ---
const getTodayStr = () => new Date().toISOString().split('T')[0];
const getCurrentMonthId = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const decode = (base64: string) => Uint8Array.from(atob(base64), c => c.charCodeAt(0));
async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) { channelData[i] = dataInt16[i * numChannels + channel] / 32768.0; }
  }
  return buffer;
}

// --- Components ---
const CircularTimer = ({ durationMinutes, onComplete, onCancel, onTimeWarp }: any) => {
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);
  const [isActive, setIsActive] = useState(true);
  useEffect(() => {
    let interval: any;
    if (isActive && timeLeft > 0) { interval = setInterval(() => setTimeLeft((p) => p - 1), 1000); }
    else if (timeLeft <= 0) { onComplete(); setIsActive(false); }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, onComplete]);
  const progress = timeLeft / (durationMinutes * 60);
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex flex-col items-center space-y-6 w-full">
      <div className="relative flex items-center justify-center">
        <svg viewBox="0 0 192 192" className="w-48 h-48 md:w-56 md:h-56 transform -rotate-90">
          <circle cx="96" cy="96" r={radius} stroke="#E2E8F0" strokeWidth="8" fill="transparent" />
          <circle cx="96" cy="96" r={radius} stroke="#6366F1" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} strokeLinecap="round" className="transition-all duration-1000 ease-linear" />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-4xl font-black text-slate-800">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Remaining</span>
        </div>
      </div>
      <div className="flex gap-4">
        <button onClick={() => setIsActive(!isActive)} className="p-4 rounded-full bg-indigo-600 text-white shadow-lg active:scale-95">{isActive ? <Pause /> : <Play />}</button>
        <button onClick={onCancel} className="p-4 rounded-full bg-slate-100 text-slate-400 active:scale-95"><RotateCcw /></button>
        <button onClick={onTimeWarp} className="px-6 py-4 bg-amber-400 text-white rounded-full font-black shadow-lg flex items-center gap-2 active:scale-95"><FastForward size={20} /> 타임워프</button>
      </div>
    </div>
  );
};

const StickerBoard = ({ stickers, monthId, canSelectSticker, onSelectSticker, rewardConfig }: any) => {
  const [year, month] = monthId.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    const found = stickers.find((s: any) => s.date === dStr);
    return { day: i + 1, date: dStr, ...found };
  });
  const total = stickers.reduce((a: number, c: any) => a + c.count, 0);
  const currentReward = () => {
    if (!rewardConfig.steps.length) return "설정 전";
    const step = [...rewardConfig.steps].sort((a, b) => b.stickers - a.stickers).find(s => total >= s.stickers);
    return step ? (rewardConfig.type === 'currency' ? `₩${Number(step.text).toLocaleString()}` : step.text) : (rewardConfig.steps[0].text);
  };
  return (
    <div className="bg-white rounded-[32px] p-6 shadow-xl border-4 border-indigo-100">
      <div className="text-center mb-6"><span className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full font-black text-sm">{month}월 미션 판</span></div>
      <div className="grid grid-cols-5 gap-3 mb-6">
        {days.map(d => (
          <div key={d.day} className={`aspect-square rounded-full border-2 flex items-center justify-center relative ${d.count ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
            <span className="absolute top-1 text-[8px] text-slate-300">{d.day}</span>
            {d.count > 0 && <Star className="text-amber-400 fill-amber-300" size={20} />}
          </div>
        ))}
        {['star', 'heart', 'rocket', 'crown'].map((t, i) => (
          <button key={i} disabled={!canSelectSticker} onClick={() => onSelectSticker(t)} className={`aspect-square rounded-full border-2 border-dashed flex items-center justify-center transition-all ${canSelectSticker ? 'border-indigo-300 text-indigo-400 hover:scale-110' : 'opacity-20 grayscale'}`}>
             <Plus size={16} />
          </button>
        ))}
      </div>
      <div className="bg-slate-50 rounded-2xl p-4 flex justify-between items-center border border-slate-100">
        <span className="text-xs font-black text-slate-500">현재 달성 보상</span>
        <span className="text-lg font-black text-green-600">{currentReward()}</span>
      </div>
    </div>
  );
};

// --- App ---
export function App() {
  const [mode, setMode] = useState<'child' | 'parent' | 'auth' | 'archives' | 'timeWarpAuth'>('child');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [stickers, setStickers] = useState<StickerDay[]>([]);
  const [childProfile, setChildProfile] = useState<ChildProfile>({ name: '', photo: null });
  const [rewardConfig, setRewardConfig] = useState<RewardConfig>({ type: 'currency', steps: [] });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pin, setPin] = useState('');

  useEffect(() => {
    const load = (key: string, def: any) => { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; };
    setMissions(load(MISSIONS_KEY, []));
    setStickers(load(STICKERS_KEY, []));
    setChildProfile(load(PROFILE_KEY, { name: '', photo: null }));
    setRewardConfig(load(REWARD_CONFIG_KEY, { type: 'currency', steps: [] }));
  }, []);

  useEffect(() => { localStorage.setItem(MISSIONS_KEY, JSON.stringify(missions)); }, [missions]);
  useEffect(() => { localStorage.setItem(STICKERS_KEY, JSON.stringify(stickers)); }, [stickers]);
  useEffect(() => { localStorage.setItem(PROFILE_KEY, JSON.stringify(childProfile)); }, [childProfile]);
  useEffect(() => { localStorage.setItem(REWARD_CONFIG_KEY, JSON.stringify(rewardConfig)); }, [rewardConfig]);

  const speak = async (text: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const res = await ai.models.generateContent({ model: "gemini-2.5-flash-preview-tts", contents: [{ parts: [{ text }] }], config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } } });
      const data = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (data) {
        const ctx = new AudioContext();
        const buf = await decodeAudioData(decode(data), ctx, 24000, 1);
        const s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination); s.start();
      }
    } catch (e) { console.error(e); }
  };

  const handleComplete = (id: string) => {
    setMissions(prev => prev.map(m => m.id === id ? { ...m, status: 'completed', completedAt: Date.now() } : m));
    setActiveId(null);
    speak(encouragingPhrases[Math.floor(Math.random() * encouragingPhrases.length)]);
  };

  if (!childProfile.name && mode === 'child') return (
    <div className="min-h-screen flex items-center justify-center bg-indigo-50 p-6">
      <div className="bg-white p-8 rounded-[40px] shadow-2xl w-full max-w-sm text-center">
        <h2 className="text-2xl font-black text-slate-800 mb-6">아이 이름을 알려주세요!</h2>
        <input className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-indigo-100 mb-4 font-bold" placeholder="아이 이름" onChange={e => setChildProfile({...childProfile, name: e.target.value})} />
        <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg" onClick={() => childProfile.name && setMode('child')}>시작하기 🚀</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col font-sans">
      {mode === 'auth' && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-8">
          <Lock className="text-indigo-600 mb-6" size={48} />
          <h2 className="text-2xl font-black mb-8">부모 보안 확인</h2>
          <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
            {[1,2,3,4,5,6,7,8,9,0].map(n => <button key={n} className="h-16 rounded-2xl bg-slate-50 text-2xl font-black text-slate-600 active:bg-indigo-100" onClick={() => {
              const next = pin + n; setPin(next);
              if (next === (localStorage.getItem(PIN_KEY) || DEFAULT_PIN)) { setMode('parent'); setPin(''); }
              else if (next.length >= 4) setPin('');
            }}>{n}</button>)}
            <button className="h-16 col-span-2 rounded-2xl bg-red-50 text-red-500 font-bold" onClick={() => { setMode('child'); setPin(''); }}>취소</button>
          </div>
        </div>
      )}

      {mode === 'parent' ? (
        <div className="p-6 space-y-6">
          <header className="flex justify-between items-center"><h1 className="text-xl font-black text-slate-800">부모 모드</h1><button onClick={() => setMode('child')} className="p-3 rounded-xl bg-white shadow-sm text-slate-400"><X /></button></header>
          <div className="bg-white p-6 rounded-3xl shadow-sm border space-y-4">
            <h3 className="font-black text-slate-700">미션 추가</h3>
            <form className="space-y-3" onSubmit={e => {
              e.preventDefault(); const f = e.target as any;
              setMissions([...missions, { id: Math.random().toString(36).substr(2,9), title: f.title.value, durationMinutes: Number(f.dur.value), reward: f.rew.value, status: 'pending', createdAt: Date.now() }]);
              f.reset();
            }}>
              <input name="title" className="w-full p-3 bg-slate-50 rounded-xl" placeholder="미션 이름" required />
              <div className="flex gap-2">
                <input name="dur" type="number" className="flex-1 p-3 bg-slate-50 rounded-xl" placeholder="분" required />
                <input name="rew" className="flex-1 p-3 bg-slate-50 rounded-xl" placeholder="보상" required />
              </div>
              <button className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg">미션 추가 ➕</button>
            </form>
          </div>
          <div className="space-y-3">
            {missions.map(m => (
              <div key={m.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center">
                <div><h4 className="font-bold text-slate-800">{m.title}</h4><p className="text-[10px] text-slate-400">{m.durationMinutes}분 | {m.reward}</p></div>
                <button onClick={() => setMissions(missions.filter(x => x.id !== m.id))} className="text-red-300"><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-6 space-y-6 flex-1 flex flex-col">
          <header className="flex justify-between items-center">
            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-black text-indigo-600">{childProfile.name[0]}</div><span className="font-black text-slate-800">{childProfile.name}</span></div>
            <button onClick={() => setMode('auth')} className="p-3 rounded-xl bg-white shadow-sm text-slate-300"><Settings size={20} /></button>
          </header>
          {activeId ? (
            <CircularTimer durationMinutes={missions.find(m => m.id === activeId)?.durationMinutes || 0} onComplete={() => handleComplete(activeId)} onCancel={() => setActiveId(null)} onTimeWarp={() => handleComplete(activeId)} />
          ) : (
            <>
              <StickerBoard stickers={stickers} monthId={getCurrentMonthId()} canSelectSticker={missions.length > 0 && missions.every(m => m.status === 'completed') && !stickers.find(s => s.date === getTodayStr())} onSelectSticker={(t: StickerType) => setStickers([...stickers, { date: getTodayStr(), count: 1, stickerType: t }])} rewardConfig={rewardConfig} />
              <div className="space-y-4">
                <h3 className="font-black text-slate-700 flex items-center gap-2"><Zap size={18} className="text-amber-400 fill-amber-400" /> 오늘의 도전</h3>
                <div className="space-y-3">
                  {missions.map(m => (
                    <button key={m.id} disabled={m.status === 'completed'} onClick={() => setActiveId(m.id)} className={`w-full p-5 rounded-[28px] border-2 text-left flex items-center gap-4 transition-all ${m.status === 'completed' ? 'bg-green-50 border-green-100 opacity-60' : 'bg-white border-slate-100 shadow-sm active:scale-95'}`}>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${m.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-indigo-50 text-indigo-600'}`}>{m.status === 'completed' ? <ThumbsUp size={20} /> : m.durationMinutes}</div>
                      <div className="flex-1"><h4 className="font-black text-slate-800">{m.title}</h4><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.reward}</p></div>
                      <Trophy className={m.status === 'completed' ? 'text-green-500' : 'text-slate-200'} />
                    </button>
                  ))}
                  {!missions.length && <div className="text-center py-12 text-slate-300 font-bold italic">부모님 모드에서 미션을 만들어주세요!</div>}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);