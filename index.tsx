import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Settings, 
  LayoutDashboard, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Lock,
  Trophy,
  Zap,
  Calendar,
  ChevronDown,
  ChevronUp,
  Star,
  Award,
  Medal,
  Crown,
  Gift,
  Sparkles,
  Heart,
  Rocket,
  Archive,
  History,
  Box,
  KeyRound,
  Eye,
  EyeOff,
  ThumbsUp,
  FastForward,
  Save,
  FolderOpen,
  User,
  ImageIcon,
  BarChart3,
  MessageCircleHeart,
  X,
  RefreshCw
} from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";

// --- Types & Constants ---

type MissionStatus = 'pending' | 'active' | 'completed';
type StickerType = 'medal' | 'star' | 'heart' | 'rocket' | 'crown';
type PinChangeStep = 'none' | 'current' | 'new' | 'verify' | 'confirm';

interface Mission {
  id: string;
  title: string;
  durationMinutes: number;
  reward: string;
  status: MissionStatus;
  createdAt: number;
  completedAt?: number;
}

interface RewardStep {
  stickers: number;
  text: string;
}

interface RewardConfig {
  type: 'currency' | 'text';
  steps: RewardStep[];
}

interface MissionPreset {
  id: string;
  name: string;
  missions: Omit<Mission, 'id' | 'status' | 'createdAt' | 'completedAt'>[];
}

interface StickerDay {
  date: string; // YYYY-MM-DD
  count: number;
  isBonusUsed?: boolean;
  stickerType?: StickerType;
}

interface MissionLog {
  date: string;
  title: string;
}

interface ChildProfile {
  name: string;
  photo: string | null;
}

interface ArchiveEntry {
  monthId: string; // YYYY-MM
  stickers: StickerDay[];
  totalStickers: number;
  archivedAt: number;
}

const PIN_KEY = 'mission_master_pin';
const MISSIONS_KEY = 'mission_master_missions';
const STICKERS_KEY = 'mission_master_stickers';
const BONUS_STICKERS_KEY = 'mission_master_bonus_stickers';
const ARCHIVES_KEY = 'mission_master_archives';
const CURRENT_MONTH_KEY = 'mission_master_current_month';
const LAST_RESET_KEY = 'mission_master_last_reset';
const PRESETS_KEY = 'mission_master_presets';
const REWARD_CONFIG_KEY = 'mission_master_reward_config';
const PROFILE_KEY = 'mission_master_profile';
const MISSION_LOG_KEY = 'mission_master_logs';
const DEFAULT_PIN = '1234';

const INITIAL_REWARD_CONFIG: RewardConfig = {
  type: 'currency',
  steps: [] 
};

const encouragingPhrases = [
  "대단해! 멋지게 해냈구나?",
  "정말 잘했어! 굉장한걸?",
  "오늘 정말 최고야! ✨",
  "우와, 미션 클리어! 🏆",
  "역시 넌 할 수 있을 줄 알았어!",
  "너의 노력이 정말 멋져! 💖",
  "최고야! 다음 단계로 가보자! 🚀"
];

// --- Utils ---

const getEncouragingPhrase = (id: string) => {
  const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % encouragingPhrases.length;
  return encouragingPhrases[index];
};

const getTodayStr = () => new Date().toISOString().split('T')[0];
const getCurrentMonthId = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- Components ---

const CircularTimer = ({ 
  durationMinutes, 
  onComplete, 
  onCancel,
  onTimeWarp
}: { 
  durationMinutes: number; 
  onComplete: () => void; 
  onCancel: () => void;
  onTimeWarp: () => void;
}) => {
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);
  const [isActive, setIsActive] = useState(true);
  const totalSeconds = durationMinutes * 60;
  
  useEffect(() => {
    let interval: any;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft <= 0) {
      onComplete();
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, onComplete]);

  const progress = timeLeft / totalSeconds;
  const radius = 80; 
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center space-y-4 md:space-y-6 w-full">
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-2 bg-white rounded-full shadow-[0_0_20px_rgba(0,0,0,0.05)] transform scale-110"></div>
        <svg viewBox="0 0 192 192" className="w-32 h-32 md:w-52 md:h-52 transform -rotate-90 relative z-10">
          <circle cx="96" cy="96" r={radius} stroke="#E0E7FF" strokeWidth="10" fill="transparent" />
          <circle
            cx="96"
            cy="96"
            r={radius}
            stroke="currentColor"
            strokeWidth="10"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="text-indigo-400 transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-indigo-900 z-10">
          <span className="text-2xl md:text-4xl font-black font-mono tracking-tighter drop-shadow-sm">{formatTime(Math.max(0, timeLeft))}</span>
          <span className="text-[8px] md:text-[10px] opacity-50 uppercase tracking-[0.2em] mt-1 font-bold">남은 시간</span>
        </div>
      </div>
      <div className="flex gap-4">
        <button onClick={() => setIsActive(!isActive)} className={`p-3 md:p-4 rounded-full transition-all active:scale-90 shadow-md ${isActive ? 'bg-white text-indigo-500 hover:bg-indigo-50' : 'bg-indigo-500 text-white'}`}>
          {isActive ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
        <button onClick={onCancel} className="p-3 md:p-4 rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-all active:scale-90 shadow-md">
          <RotateCcw size={20} />
        </button>
        <button onClick={onTimeWarp} className="flex items-center gap-2 px-4 py-3 bg-amber-400 text-white rounded-full font-black shadow-lg hover:bg-amber-500 transition-all active:scale-95 group">
          <FastForward size={20} />
          <span className="text-xs md:text-sm">타임워프</span>
        </button>
      </div>
    </div>
  );
};

const StickerIcon = ({ type, size = 28 }: { type?: StickerType, size?: number }) => {
  switch (type) {
    case 'star': return <Star size={size} className="text-amber-400 fill-amber-300" />;
    case 'heart': return <Heart size={size} className="text-rose-400 fill-rose-300" />;
    case 'rocket': return <Rocket size={size} className="text-blue-400 fill-blue-300" />;
    case 'crown': return <Crown size={size} className="text-purple-400 fill-purple-300" />;
    default: return (
       <div className="relative">
         <Medal size={size} className="text-indigo-500 fill-indigo-200" />
         <CheckCircle2 size={size * 0.4} className="absolute -bottom-1 -right-1 text-green-500 bg-white rounded-full ring-2 ring-white" />
       </div>
    );
  }
};

const StickerBoard = ({ 
  stickers, 
  monthId,
  canSelectSticker,
  onSelectSticker,
  rewardConfig
}: { 
  stickers: StickerDay[], 
  monthId: string,
  canSelectSticker?: boolean,
  onSelectSticker?: (type: StickerType) => void,
  rewardConfig: RewardConfig
}) => {
  const [year, month] = monthId.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const days = useMemo(() => {
    const arr = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const dStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const found = stickers.find(s => s.date === dStr);
      arr.push({ 
        day: i, 
        date: dStr, 
        count: found ? found.count : 0, 
        isBonusUsed: found?.isBonusUsed,
        stickerType: found?.stickerType 
      });
    }
    return arr;
  }, [stickers, year, month, daysInMonth]);

  const totalStickers = stickers.reduce((acc, curr) => acc + curr.count, 0);

  const getCurrentReward = () => {
    if (rewardConfig.steps.length === 0) return "설정 전";
    let current = rewardConfig.steps[0]?.text || '0';
    const sortedSteps = [...rewardConfig.steps].sort((a, b) => b.stickers - a.stickers);
    for (const step of sortedSteps) {
      if (totalStickers >= step.stickers) {
        current = step.text;
        break;
      }
    }
    if (rewardConfig.type === 'currency' && !isNaN(Number(current))) {
      return `₩${Number(current).toLocaleString()}`;
    }
    return current;
  };

  const stickerOptions: { type: StickerType, color: string }[] = [
    { type: 'star', color: 'bg-amber-50 border-amber-200 hover:bg-amber-100' },
    { type: 'heart', color: 'bg-rose-50 border-rose-200 hover:bg-rose-100' },
    { type: 'rocket', color: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
    { type: 'crown', color: 'bg-purple-50 border-purple-200 hover:bg-purple-100' },
  ];

  return (
    <div className="relative overflow-visible bg-white rounded-[24px] p-4 md:p-6 shadow-xl border-[4px] border-indigo-200/80 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex flex-col items-center justify-center mb-6 md:mb-8 relative">
         <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-6 bg-indigo-50 -z-10 rounded-b-3xl border-b border-l border-r border-indigo-100"></div>
         <div className="flex items-center gap-2 bg-indigo-50/80 backdrop-blur-sm px-4 md:px-6 py-2 rounded-full shadow-sm border border-indigo-200 mb-1">
            <Calendar size={16} className="text-indigo-500" />
            <span className="font-black text-indigo-900 text-sm md:text-lg">{month}월의 미션 스티커판</span>
         </div>
      </div>

      <div className="grid grid-cols-5 gap-2 md:gap-4 relative z-10 mb-6">
        {days.map((item) => {
           const rotation = (item.day * 33) % 10 - 5; 
           const isFuture = new Date(item.date) > new Date();
           return (
            <div key={item.day} className="relative aspect-square">
              <div className={`w-full h-full rounded-full flex items-center justify-center text-xs md:text-lg font-black transition-all border-[2px] relative
                ${item.count > 0 
                  ? item.isBonusUsed ? 'bg-amber-50 border-amber-200 shadow-md scale-105' : 'bg-indigo-50 border-indigo-300 shadow-md scale-105' 
                  : 'bg-slate-50 border-slate-100 text-slate-300'
                }
                ${isFuture ? 'opacity-40' : ''}`}
              >
                <span className="absolute top-0.5 text-[7px] md:top-1 md:text-[8px] text-slate-400 font-normal">{item.day}</span>
                {item.count > 0 && (
                  <div style={{ transform: `rotate(${rotation}deg)` }} className="relative drop-shadow-sm mt-0.5">
                    {item.isBonusUsed ? <Star className="w-5 h-5 md:w-7 md:h-7 text-amber-400 fill-amber-300" /> : <StickerIcon type={item.stickerType} size={window.innerWidth < 768 ? 16 : 24} />}
                  </div>
                )}
              </div>
            </div>
           );
        })}
        {stickerOptions.map((option, idx) => (
          <div key={`sticker-opt-${idx}`} className="relative aspect-square flex items-center justify-center">
            <button
              disabled={!canSelectSticker}
              onClick={() => onSelectSticker?.(option.type)}
              className={`w-full h-full rounded-full border-[2px] flex items-center justify-center transition-all duration-300 transform ${option.color} ${canSelectSticker ? 'opacity-100 scale-100 hover:scale-110 cursor-pointer shadow-md' : 'opacity-30 scale-90 grayscale cursor-not-allowed border-dashed'}`}
            >
              <StickerIcon type={option.type} size={window.innerWidth < 768 ? 14 : 20} />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 rounded-xl p-3 md:p-4 border border-slate-100">
         <div className="flex justify-between items-center mb-2">
            <h4 className="text-[10px] md:text-xs font-black text-slate-500 flex items-center gap-1.5"><Gift size={14} className="text-pink-400" /> 보상 현황</h4>
            <div className="text-right flex items-baseline gap-1">
              <span className="text-[8px] md:text-[10px] font-bold text-slate-400">{rewardConfig.type === 'currency' ? '현재 용돈' : '현재 보상'}</span>
              <span className="text-xs md:text-base font-black text-green-500">{getCurrentReward()}</span>
            </div>
         </div>
         {rewardConfig.steps.length === 0 ? (
           <p className="text-[10px] text-slate-400 text-center py-1">부모님 모드에서 보상 단계를 추가해주세요!</p>
         ) : (
           <div className="flex justify-between gap-1 text-center overflow-x-auto pb-1">
              {rewardConfig.steps.map((step, idx) => {
                 const achieved = totalStickers >= step.stickers;
                 return (
                    <div key={idx} className={`flex-1 min-w-[50px] flex flex-col items-center transition-all ${achieved ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                       <div className={`w-full py-0.5 rounded-t-lg text-[7px] md:text-[9px] font-bold text-white mb-px ${idx === rewardConfig.steps.length - 1 ? 'bg-pink-400' : 'bg-indigo-300'}`}>{step.stickers}개~</div>
                       <div className={`w-full py-1 bg-white border border-b-2 rounded-b-lg flex flex-col items-center justify-center ${achieved ? 'border-green-400' : 'border-slate-200'}`}>
                          <span className={`text-[7px] md:text-xs font-black truncate w-full px-1 ${achieved ? 'text-slate-700' : 'text-slate-400'}`}>
                            {rewardConfig.type === 'currency' ? (Number(step.text) >= 1000 ? `${Number(step.text)/1000}천` : step.text) : step.text}
                          </span>
                       </div>
                    </div>
                 );
              })}
           </div>
         )}
      </div>
    </div>
  );
};

// --- Main App ---

export function App() {
  const [mode, setMode] = useState<'child' | 'parent' | 'auth' | 'archives' | 'timeWarpAuth'>('child');
  const [pinInput, setPinInput] = useState('');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [stickers, setStickers] = useState<StickerDay[]>([]);
  const [bonusStickers, setBonusStickers] = useState<number>(0);
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);
  const [currentMonthId, setCurrentMonthId] = useState<string>(getCurrentMonthId());
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isBoardExpanded, setIsBoardExpanded] = useState(false);
  const [presets, setPresets] = useState<MissionPreset[]>([]);
  const [rewardConfig, setRewardConfig] = useState<RewardConfig>(INITIAL_REWARD_CONFIG);
  const [childProfile, setChildProfile] = useState<ChildProfile>({ name: '', photo: null });
  const [missionLogs, setMissionLogs] = useState<MissionLog[]>([]);
  const [aiMessage, setAiMessage] = useState<string>('반가워요! 오늘의 미션을 시작해볼까요?');

  // UI States
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isRewardConfigExpanded, setIsRewardConfigExpanded] = useState(false);
  const [isAddMissionExpanded, setIsAddMissionExpanded] = useState(false);
  const [isPresetPopupOpen, setIsPresetPopupOpen] = useState(false);
  
  // PIN Change State
  const [pinChangeStep, setPinChangeStep] = useState<PinChangeStep>('none');
  const [tempNewPin, setTempNewPin] = useState('');

  useEffect(() => {
    const savedMissions = localStorage.getItem(MISSIONS_KEY);
    const savedStickers = localStorage.getItem(STICKERS_KEY);
    const savedBonus = localStorage.getItem(BONUS_STICKERS_KEY);
    const savedArchives = localStorage.getItem(ARCHIVES_KEY);
    const savedMonthId = localStorage.getItem(CURRENT_MONTH_KEY);
    const lastReset = localStorage.getItem(LAST_RESET_KEY);
    const savedPresets = localStorage.getItem(PRESETS_KEY);
    const savedRewardConfig = localStorage.getItem(REWARD_CONFIG_KEY);
    const savedProfile = localStorage.getItem(PROFILE_KEY);
    const savedLogs = localStorage.getItem(MISSION_LOG_KEY);
    
    let loadedMissions: Mission[] = savedMissions ? JSON.parse(savedMissions) : [];
    const today = getTodayStr();
    if (lastReset !== today) {
      loadedMissions = loadedMissions.map(m => ({ ...m, status: 'pending' as MissionStatus }));
      localStorage.setItem(LAST_RESET_KEY, today);
    }
    
    setMissions(loadedMissions);
    if (savedStickers) setStickers(JSON.parse(savedStickers));
    if (savedBonus) setBonusStickers(parseInt(savedBonus));
    if (savedArchives) setArchives(JSON.parse(savedArchives));
    if (savedMonthId) setCurrentMonthId(savedMonthId);
    if (savedPresets) setPresets(JSON.parse(savedPresets));
    if (savedRewardConfig) setRewardConfig(JSON.parse(savedRewardConfig));
    if (savedProfile) {
      const parsedProfile = JSON.parse(savedProfile);
      setChildProfile(parsedProfile);
      if (!parsedProfile.name) setIsProfileModalOpen(true);
    } else {
      setIsProfileModalOpen(true); 
    }
    if (savedLogs) setMissionLogs(JSON.parse(savedLogs));
    else localStorage.setItem(CURRENT_MONTH_KEY, currentMonthId);

    if (savedLogs) generateAiMessage(JSON.parse(savedLogs));
  }, []);

  useEffect(() => { localStorage.setItem(MISSIONS_KEY, JSON.stringify(missions)); }, [missions]);
  useEffect(() => { localStorage.setItem(STICKERS_KEY, JSON.stringify(stickers)); }, [stickers]);
  useEffect(() => { localStorage.setItem(BONUS_STICKERS_KEY, bonusStickers.toString()); }, [bonusStickers]);
  useEffect(() => { localStorage.setItem(ARCHIVES_KEY, JSON.stringify(archives)); }, [archives]);
  useEffect(() => { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); }, [presets]);
  useEffect(() => { localStorage.setItem(REWARD_CONFIG_KEY, JSON.stringify(rewardConfig)); }, [rewardConfig]);
  useEffect(() => { localStorage.setItem(PROFILE_KEY, JSON.stringify(childProfile)); }, [childProfile]);
  useEffect(() => { localStorage.setItem(MISSION_LOG_KEY, JSON.stringify(missionLogs)); }, [missionLogs]);

  const playMissionCompleteVoice = async (isBonus: boolean) => {
    try {
      const phrase = isBonus ? "보너스 스티커를 획득했어! 정말 대단해!" : encouragingPhrases[Math.floor(Math.random() * encouragingPhrases.length)];
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: phrase }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
        const source = outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputAudioContext.destination);
        source.start();
      }
    } catch (e) {
      console.error("TTS Error:", e);
    }
  };

  const generateAiMessage = async (logs: MissionLog[]) => {
    if (!childProfile.name) return;
    try {
      const today = new Date();
      const currentMonthLogs = logs.filter(log => log.date.startsWith(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`));
      
      const missionStats = currentMonthLogs.reduce((acc, log) => {
        acc[log.title] = (acc[log.title] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const prompt = `아이 이름: ${childProfile.name}. 이번 달 미션 수행 데이터: ${JSON.stringify(missionStats)}. 이 데이터를 바탕으로 부모님께 드리는 따뜻한 격려와 조언을 한 줄(30자 이내)로 작성해줘.`;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      if (response.text) setAiMessage(response.text.trim());
    } catch (e) {
      console.error("AI Message Error:", e);
    }
  };

  const handleStartNewMonth = () => {
    if (confirm(`새로운 달의 미션판으로 전환하시겠습니까?`)) {
      const entry: ArchiveEntry = {
        monthId: currentMonthId,
        stickers: [...stickers],
        totalStickers: stickers.reduce((acc, s) => acc + s.count, 0),
        archivedAt: Date.now()
      };
      setArchives([entry, ...archives]);
      const newMonthId = getCurrentMonthId();
      setCurrentMonthId(newMonthId);
      localStorage.setItem(CURRENT_MONTH_KEY, newMonthId);
      setStickers([]);
      setMissionLogs([]);
      alert('새로운 달의 미션판이 생성되었습니다!');
    }
  };

  const handleAddMission = (title: string, duration: number, reward: string) => {
    const newMission: Mission = { id: Math.random().toString(36).substr(2, 9), title, durationMinutes: duration, reward, status: 'pending', createdAt: Date.now() };
    setMissions([...missions, newMission]);
    setIsAddMissionExpanded(false);
  };

  const handleDeleteMission = (id: string) => setMissions(missions.filter(m => m.id !== id));

  const handleStartMission = (id: string) => {
    setMissions(prev => prev.map(m => m.id === id ? { ...m, status: 'active' } : m));
    setActiveMissionId(id);
  };

  const handleCancelMission = (id: string) => {
    setMissions(prev => prev.map(m => m.id === id ? { ...m, status: 'pending' } : m));
    setActiveMissionId(null);
  };

  const handleCompleteMission = async (id: string) => {
    const mission = missions.find(m => m.id === id);
    if (mission) {
      setMissionLogs(prev => [...prev, { date: getTodayStr(), title: mission.title }]);
      setMissions(prev => prev.map(m => m.id === id ? { ...m, status: 'completed', completedAt: Date.now() } : m));
    }
    setActiveMissionId(null);
  };

  const handleSelectSticker = async (type: StickerType) => {
    const today = getTodayStr();
    if (stickers.find(s => s.date === today && s.count > 0)) return; 
    
    setShowConfetti(true);
    setStickers(prev => [...prev, { date: today, count: 1, stickerType: type }]);
    await playMissionCompleteVoice(false);
    setTimeout(() => { setShowConfetti(false); }, 6000);
  };

  const handleUseBonusSticker = () => {
    if (bonusStickers <= 0) return;
    const [y, m] = currentMonthId.split('-').map(Number);
    const stickerMap = new Map<string, StickerDay>(stickers.map(s => [s.date, s]));
    let targetDateStr = null;
    for (let i = 1; i <= new Date(y, m, 0).getDate(); i++) {
       const dStr = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
       if (!stickerMap.has(dStr)) { targetDateStr = dStr; break; }
    }
    if (targetDateStr && confirm(`보너스 스티커로 빈 칸을 채울까요?`)) {
      setBonusStickers(prev => prev - 1);
      setStickers(prev => [...prev, { date: targetDateStr!, count: 1, isBonusUsed: true, stickerType: 'star' }]);
    }
  };

  const handleSavePreset = () => {
    const name = prompt('프리셋 이름을 입력하세요', '나의 미션 세트');
    if (name) {
      setPresets([...presets, { id: Math.random().toString(36).substr(2, 9), name, missions: missions.map(({title, durationMinutes, reward}) => ({title, durationMinutes, reward})) }]);
      alert('프리셋이 저장되었습니다.');
    }
  };

  const handleLoadPreset = (preset: MissionPreset) => {
    if (confirm(`'${preset.name}' 프리셋을 불러오시겠습니까?`)) {
      setMissions(preset.missions.map(pm => ({ ...pm, id: Math.random().toString(36).substr(2, 9), status: 'pending', createdAt: Date.now() })));
      setIsPresetPopupOpen(false);
    }
  };

  const handlePinInput = (digit: string) => {
    const currentSavedPin = localStorage.getItem(PIN_KEY) || DEFAULT_PIN;
    const nextInput = pinInput + digit;
    setPinInput(nextInput);

    if (mode === 'timeWarpAuth') {
       if (nextInput === currentSavedPin) {
          if (activeMissionId) handleCompleteMission(activeMissionId);
          setMode('child');
          setPinInput('');
       } else if (nextInput.length === 4) setTimeout(() => setPinInput(''), 500);
       return;
    }

    if (pinChangeStep === 'none') {
      if (nextInput === currentSavedPin) { setMode('parent'); setPinInput(''); }
      else if (nextInput.length === 4) setTimeout(() => setPinInput(''), 500);
    } else if (pinChangeStep === 'current') {
      if (nextInput === currentSavedPin) { setPinChangeStep('new'); setPinInput(''); }
      else if (nextInput.length === 4) { alert('PIN이 일치하지 않습니다.'); setPinInput(''); }
    } else if (pinChangeStep === 'new' && nextInput.length === 4) { setTempNewPin(nextInput); setPinChangeStep('verify'); setPinInput(''); }
    else if (pinChangeStep === 'verify' && nextInput.length === 4) {
      if (nextInput === tempNewPin) { setPinChangeStep('confirm'); setPinInput(''); }
      else { alert('비밀번호가 다릅니다.'); setPinChangeStep('new'); setPinInput(''); }
    }
  };

  const activeMission = missions.find(m => m.id === activeMissionId);
  const pendingMissions = missions.filter(m => m.status === 'pending');
  const hasStickerToday = stickers.some(s => s.date === getTodayStr() && s.count > 0);
  const canSelectSticker = pendingMissions.length === 0 && !hasStickerToday && missions.length > 0 && !activeMission;

  const today = new Date();
  const daysInCurrentMonth = today.getDate();
  const stickersInCurrentMonth = stickers.filter(s => s.date.startsWith(currentMonthId)).length;
  const completionRate = Math.round((stickersInCurrentMonth / daysInCurrentMonth) * 100) || 0;

  const missionCompletionStats = missions.map(m => {
    const count = missionLogs.filter(log => log.title === m.title && log.date.startsWith(currentMonthId)).length;
    const rate = Math.round((count / daysInCurrentMonth) * 100);
    return { title: m.title, count, rate };
  });

  const ProfileDisplay = ({ onClick, showEditLabel = false }: { onClick?: () => void, showEditLabel?: boolean }) => (
    <div onClick={onClick} className={`flex items-center gap-3 cursor-pointer group transition-all ${onClick ? 'hover:bg-slate-50 p-2 rounded-2xl' : 'p-1'}`}>
      <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center overflow-hidden border-2 border-indigo-100 shadow-sm shrink-0">
        {childProfile.photo ? <img src={childProfile.photo} className="w-full h-full object-cover" alt="child" /> : <User size={22} className="text-indigo-300" />}
      </div>
      <div className="min-w-0">
        <p className="font-black text-indigo-900 text-base leading-tight truncate">{childProfile.name || '아이 이름'}</p>
        {showEditLabel && <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">프로필 수정</p>}
      </div>
    </div>
  );

  return (
    <div className="app-container antialiased font-sans text-[clamp(0.875rem,2.5vw,1rem)] bg-slate-50 min-h-screen">
      
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
          <div className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800">아이 정보 설정</h3>
              {!childProfile.name && <span className="text-[10px] font-bold text-indigo-500">환영합니다!</span>}
              {childProfile.name && <button onClick={() => setIsProfileModalOpen(false)} className="p-2 text-slate-300 hover:text-slate-500"><X /></button>}
            </div>
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-3">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center border-4 border-white shadow-md relative overflow-hidden group">
                   {childProfile.photo ? <img src={childProfile.photo} className="w-full h-full object-cover" alt="preview" /> : <User size={40} className="text-slate-200" />}
                   <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <ImageIcon className="text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setChildProfile({...childProfile, photo: reader.result as string});
                          reader.readAsDataURL(file);
                        }
                      }} />
                   </label>
                </div>
                <p className="text-[10px] font-bold text-slate-400">사진을 클릭하여 변경 (선택)</p>
              </div>
              <div>
                <label className="text-xs font-black text-slate-500 mb-2 block">아이 이름 (필수)</label>
                <input value={childProfile.name} onChange={(e) => setChildProfile({...childProfile, name: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border font-bold text-slate-800 focus:ring-2 focus:ring-indigo-200 outline-none" placeholder="아이의 이름을 입력해주세요" />
              </div>
              <button onClick={() => { if (!childProfile.name.trim()) return alert('이름을 입력해주세요!'); setIsProfileModalOpen(false); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100">저장하고 시작하기</button>
            </div>
          </div>
        </div>
      )}

      {isPresetPopupOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
          <div className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800">프리셋 불러오기</h3>
              <button onClick={() => setIsPresetPopupOpen(false)} className="p-2 text-slate-300 hover:text-slate-500"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {presets.length === 0 ? <p className="text-slate-400 text-center py-10 italic">저장된 프리셋이 없습니다.</p> : presets.map(p => (
                <div key={p.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group">
                  <div><p className="font-black text-slate-800 text-sm">{p.name}</p><p className="text-[10px] text-slate-400">{p.missions.length}개의 미션</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => handleLoadPreset(p)} className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-xs font-bold">선택</button>
                    <button onClick={() => setPresets(presets.filter(pr => pr.id !== p.id))} className="p-2 text-red-300 hover:text-red-500"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(mode === 'auth' || mode === 'timeWarpAuth') && (
        <div className="min-h-screen bg-indigo-50 flex flex-col items-center justify-center p-4 fixed inset-0 z-[130]">
          <div className="bg-white p-6 md:p-10 rounded-[32px] shadow-xl w-full max-w-sm text-center border border-indigo-100">
             <div className="mb-6">
              {mode === 'timeWarpAuth' ? <><FastForward className="text-amber-500 mx-auto mb-4" size={32} /><h2 className="text-2xl font-black mb-1">타임워프</h2></> : <><Lock className="text-indigo-600 mx-auto mb-4" size={32} /><h2 className="text-2xl font-black mb-1">보안 확인</h2></>}
             </div>
             <div className="flex justify-center gap-3 mb-8">
                {[0, 1, 2, 3].map(i => <div key={i} className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${pinInput.length > i ? 'bg-indigo-500 border-indigo-500 scale-125' : 'border-gray-200'}`} />)}
             </div>
             <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <button key={n} onClick={() => handlePinInput(n.toString())} className="h-14 rounded-2xl bg-gray-50 text-xl font-black text-gray-600 hover:bg-indigo-100 active:scale-95 transition-all">{n}</button>)}
                <button onClick={() => setPinInput('')} className="h-14 rounded-2xl text-gray-300 hover:bg-gray-50 flex items-center justify-center"><RotateCcw size={24} /></button>
                <button onClick={() => handlePinInput("0")} className="h-14 rounded-2xl bg-gray-50 text-xl font-black text-gray-600 hover:bg-indigo-100 active:scale-95 transition-all">0</button>
                <button onClick={() => { if (pinChangeStep !== 'none') { setPinChangeStep('none'); setPinInput(''); } else setMode('child'); }} className="h-14 rounded-2xl text-gray-300 hover:bg-gray-50 flex items-center justify-center"><ArrowLeft size={24} /></button>
             </div>
          </div>
        </div>
      )}

      {mode === 'parent' && (
        <div className="min-h-screen bg-slate-50 flex flex-col">
          <header className="bg-white px-6 py-4 shadow-sm border-b border-slate-200 sticky top-0 z-50">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setMode('child')} className="p-2.5 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 transition-all"><ArrowLeft size={20}/></button>
                <button onClick={handleStartNewMonth} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">새 달 시작하기 🚀</button>
              </div>
              <h1 className="hidden md:block text-lg font-black text-slate-800">미션 마스터 - 부모 모드</h1>
              <ProfileDisplay onClick={() => setIsProfileModalOpen(true)} showEditLabel />
            </div>
          </header>

          <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 flex-1 w-full pb-20">
            <div className="bg-white rounded-[28px] border shadow-sm overflow-hidden">
               <button onClick={() => setIsBoardExpanded(!isBoardExpanded)} className="w-full px-6 py-4 flex items-center justify-between bg-slate-50/50 transition-colors hover:bg-slate-100/50">
                  <div className="flex items-center gap-2"><Medal size={20} className="text-indigo-500"/><span className="font-black text-indigo-900 text-sm">미션 스티커판 관리</span></div>
                  {isBoardExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
               </button>
               {isBoardExpanded && <div className="p-4"><StickerBoard stickers={stickers} monthId={currentMonthId} rewardConfig={rewardConfig} /></div>}
            </div>

            <section className="bg-white p-6 rounded-[28px] border shadow-sm space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2"><BarChart3 size={18} className="text-blue-500"/> 월간 통계</h3>
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-500 px-2 py-1 rounded-md">{today.getFullYear()}년 {today.getMonth()+1}월</span>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                     <p className="text-[10px] font-bold text-blue-400 mb-1">전체 진행도</p>
                     <div className="flex items-end gap-2 mb-2"><span className="text-2xl font-black text-blue-600">{stickersInCurrentMonth}일</span><span className="text-xs font-bold text-slate-400 mb-1">/ {daysInCurrentMonth}일</span></div>
                     <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-blue-100"><div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${completionRate}%` }}></div></div>
                     <p className="text-[10px] font-black text-blue-500 mt-2 text-right">달성률 {completionRate}%</p>
                  </div>
                  <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex flex-col justify-center">
                     <div className="flex items-center gap-2 mb-2"><MessageCircleHeart size={16} className="text-indigo-400"/><span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">AI 한 줄 메시지</span></div>
                     <p className="text-sm font-bold text-slate-700 leading-snug">{aiMessage}</p>
                     <button onClick={() => generateAiMessage(missionLogs)} className="mt-2 text-[10px] text-indigo-300 font-bold flex items-center gap-1"><RefreshCw size={10}/> 다시 생성</button>
                  </div>
               </div>
            </section>

            <section className="space-y-4">
               <div className="flex items-center justify-between px-2">
                  <h3 className="text-sm font-black text-slate-700">현재 미션 목록</h3>
                  <div className="flex items-center gap-1.5">
                     <button onClick={() => setIsAddMissionExpanded(!isAddMissionExpanded)} title="미션 추가" className="p-2 bg-white rounded-xl border shadow-sm text-green-500 hover:scale-105 transition-transform"><Plus size={18}/></button>
                     <button onClick={() => { if(confirm('전체 미션을 삭제할까요?')) setMissions([]); }} title="전체 삭제" className="p-2 bg-white rounded-xl border shadow-sm text-red-500 hover:scale-105 transition-transform"><Trash2 size={18}/></button>
                     <button onClick={handleSavePreset} title="프리셋 저장" className="p-2 bg-white rounded-xl border shadow-sm text-blue-500 hover:scale-105 transition-transform"><Save size={18}/></button>
                     <button onClick={() => setIsPresetPopupOpen(true)} title="프리셋 불러오기" className="p-2 bg-white rounded-xl border shadow-sm text-amber-500 hover:scale-105 transition-transform"><FolderOpen size={18}/></button>
                  </div>
               </div>
               {isAddMissionExpanded && (
                 <div className="bg-white p-5 rounded-[24px] border border-green-100 shadow-md animate-in slide-in-from-top-2">
                    <form className="grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as any;
                      handleAddMission(form.title.value, parseInt(form.duration.value), form.reward.value);
                      form.reset();
                    }}>
                      <div className="md:col-span-1"><label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">미션 이름</label><input name="title" className="w-full p-3 rounded-xl bg-slate-50 border border-slate-100 font-bold text-slate-900 text-sm" placeholder="예: 동화책 읽기" required /></div>
                      <div><label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">시간(분)</label><input name="duration" type="number" className="w-full p-3 rounded-xl bg-slate-50 border border-slate-100 font-bold text-slate-900 text-sm" required /></div>
                      <div><label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">보상</label><input name="reward" className="w-full p-3 rounded-xl bg-slate-50 border border-slate-100 font-bold text-slate-900 text-sm" required /></div>
                      <div className="flex items-end"><button className="w-full bg-indigo-600 text-white p-3 rounded-xl font-black text-sm shadow-lg hover:bg-indigo-700">추가하기</button></div>
                    </form>
                 </div>
               )}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {missions.length === 0 ? (
                    <p className="text-xs text-slate-400 p-8 text-center border-2 border-dashed rounded-2xl w-full col-span-2">아직 등록된 미션이 없습니다.</p>
                  ) : missions.map(m => (
                    <div key={m.id} className="bg-white p-4 rounded-[20px] border shadow-sm flex items-center justify-between group">
                       <div className="min-w-0 flex-1"><h4 className="font-black text-sm text-slate-800 truncate">{m.title}</h4><p className="text-[10px] text-slate-400">{m.durationMinutes}분 | {m.reward}</p></div>
                       <button onClick={() => handleDeleteMission(m.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                  ))}
               </div>
            </section>

            <div className="bg-white rounded-[24px] border shadow-sm overflow-hidden">
               <button onClick={() => setIsRewardConfigExpanded(!isRewardConfigExpanded)} className="w-full px-6 py-4 flex items-center justify-between bg-slate-50/50 transition-colors hover:bg-slate-100/50">
                  <div className="flex items-center gap-2"><Award size={20} className="text-purple-500"/><span className="font-black text-slate-800 text-sm">보상 단계 설정</span></div>
                  {isRewardConfigExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
               </button>
               {isRewardConfigExpanded && (
                 <div className="p-5 space-y-6">
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                       <span className="text-xs font-bold text-slate-500">보상 타입:</span>
                       <select value={rewardConfig.type} onChange={(e) => setRewardConfig({...rewardConfig, type: e.target.value as any})} className="bg-white border rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-200 outline-none">
                          <option value="currency">용돈 (₩)</option><option value="text">기타 보상 (텍스트)</option>
                       </select>
                       <button onClick={() => { if(rewardConfig.steps.length >= 5) return; setRewardConfig({...rewardConfig, steps: [...rewardConfig.steps, {stickers: 0, text: ''}].sort((a,b)=>a.stickers-b.stickers)}); }} className="ml-auto px-4 py-2 bg-white border rounded-xl text-[10px] font-black hover:bg-slate-100 transition-colors">+ 단계 추가</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {rewardConfig.steps.length === 0 ? <p className="text-xs text-slate-400 text-center py-4 col-span-2 italic">보상 단계를 추가해주세요.</p> : rewardConfig.steps.map((step, idx) => (
                         <div key={idx} className="p-4 bg-white border rounded-2xl relative shadow-sm space-y-3">
                            <button onClick={() => setRewardConfig({...rewardConfig, steps: rewardConfig.steps.filter((_, i) => i !== idx)})} className="absolute top-3 right-3 text-slate-200 hover:text-red-500"><Trash2 size={14}/></button>
                            <div><span className="text-[10px] font-black text-slate-400 block mb-1">스티커 개수</span><input type="number" value={step.stickers} onChange={(e) => { const ns = [...rewardConfig.steps]; ns[idx].stickers = Number(e.target.value); setRewardConfig({...rewardConfig, steps: ns}); }} className="w-full p-2 border rounded-lg text-xs font-bold" /></div>
                            <div><span className="text-[10px] font-black text-slate-400 block mb-1">보상 내용</span><input type={rewardConfig.type === 'currency' ? 'number' : 'text'} value={step.text} onChange={(e) => { const ns = [...rewardConfig.steps]; ns[idx].text = e.target.value; setRewardConfig({...rewardConfig, steps: ns}); }} className="w-full p-2 border rounded-lg text-xs font-bold" placeholder={rewardConfig.type === 'currency' ? '예: 1000' : '예: 포켓몬 카드'} /></div>
                         </div>
                       ))}
                    </div>
                 </div>
               )}
            </div>
          </main>
        </div>
      )}

      {mode === 'child' && (
        <div className={`min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 text-slate-800 flex flex-col overflow-y-auto ${showConfetti ? 'ring-[8px] ring-amber-300 ring-inset' : ''}`}>
          
          <header className="p-4 flex justify-between items-center z-50 sticky top-0 bg-white/40 backdrop-blur-md">
            <div className="flex items-center gap-1.5"><Zap size={18} className="text-indigo-500 fill-indigo-500"/><span className="text-base font-black tracking-tighter italic text-indigo-900">미션 마스터</span></div>
            <div className="flex gap-1.5 items-center">
              <button onClick={handleUseBonusSticker} disabled={bonusStickers === 0} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all shadow-sm active:scale-95 ${bonusStickers > 0 ? 'bg-rose-50 border-rose-200 text-rose-500' : 'bg-slate-50 border-slate-100 text-slate-300 opacity-60'}`}><Box size={14} /><span className="text-[10px] font-black">{bonusStickers}개</span></button>
              <button onClick={() => setMode('archives')} className="p-2 rounded-xl bg-white text-slate-400 border border-indigo-50 shadow-sm"><Archive size={16}/></button>
              <button onClick={() => setMode('auth')} className="p-2 rounded-xl bg-white text-slate-400 border border-indigo-50 shadow-sm"><Settings size={16}/></button>
            </div>
          </header>

          <main className="flex-1 flex flex-col items-center px-4 pb-12 space-y-5 w-full max-w-lg mx-auto">
            
            <div className="w-full flex items-center justify-between gap-4 px-1 mt-6">
               <ProfileDisplay />
               <button onClick={() => setIsBoardExpanded(!isBoardExpanded)} className="px-5 py-3 bg-white border border-indigo-100 rounded-2xl shadow-sm flex items-center gap-3 transition-all active:scale-95 shrink-0 group">
                 <span className="text-indigo-600 font-black text-xs md:text-sm">스티커판 {isBoardExpanded ? '닫기' : '펼치기'}</span>
                 <div className="text-indigo-300 transition-transform duration-300" style={{ transform: isBoardExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}><ChevronDown size={18} /></div>
               </button>
            </div>

            <div className={`transition-all duration-500 ease-in-out overflow-hidden w-full ${isBoardExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
               <div className="py-2"><StickerBoard stickers={stickers} monthId={currentMonthId} canSelectSticker={canSelectSticker} onSelectSticker={handleSelectSticker} rewardConfig={rewardConfig} /></div>
            </div>

            {activeMission ? (
              <div className="w-full bg-white rounded-[32px] p-6 shadow-lg border border-indigo-50 animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center">
                <div className="text-center mb-6 space-y-1 w-full px-4"><span className="px-3 py-1 bg-indigo-50 text-indigo-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">미션 수행 중</span><h2 className="text-2xl font-black text-slate-800 leading-tight truncate">{activeMission.title}</h2></div>
                <CircularTimer durationMinutes={activeMission.durationMinutes} onComplete={() => handleCompleteMission(activeMission.id)} onCancel={() => handleCancelMission(activeMission.id)} onTimeWarp={() => setMode('timeWarpAuth')} />
                <div className="mt-6 w-full bg-amber-50 rounded-2xl p-4 flex items-center gap-4 border border-amber-100">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0"><Trophy size={20} className="text-amber-500" /></div>
                  <div className="min-w-0 flex-1"><p className="text-[8px] font-black uppercase tracking-widest text-amber-400">보상</p><p className="text-base font-black text-amber-900 truncate">{activeMission.reward}</p></div>
                </div>
              </div>
            ) : hasStickerToday ? (
              <div className="w-full py-16 flex flex-col items-center justify-center bg-white/40 rounded-[32px] border-2 border-dashed border-indigo-100/50">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md mb-6 animate-bounce"><CheckCircle2 size={32} className="text-green-500" /></div>
                <p className="text-indigo-900 font-black text-lg uppercase tracking-widest">수고했어요!</p>
                <p className="text-indigo-400 font-bold text-xs mt-1 px-8 text-center leading-relaxed">오늘의 스티커를 모두 받았어요!<br/>내일 또 즐겁게 도전해요!</p>
              </div>
            ) : (
              <div className="w-full space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-sm font-black text-slate-700 flex items-center gap-2"><Zap size={18} className="text-amber-400 fill-amber-400"/> 오늘의 미션</h2>
                  <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-100">{pendingMissions.length}개 남음</span>
                </div>
                {missions.length === 0 ? (
                  <div className="w-full py-12 flex flex-col items-center justify-center bg-white/40 rounded-[32px] border-2 border-dashed border-indigo-100/50 text-center">
                    <History size={32} className="text-indigo-200 mb-2" /><p className="text-indigo-900/40 font-black text-xs uppercase tracking-widest">미션이 없어요</p><p className="text-indigo-300 text-[10px] font-bold px-10 leading-relaxed">부모님 모드에서 오늘의 미션을<br/>등록해주세요!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingMissions.length === 0 && (
                      <div className="flex flex-col items-center space-y-2 py-8 bg-white/50 rounded-[32px] border-2 border-dashed border-indigo-100 animate-bounce">
                        <Sparkles size={28} className="text-amber-400" />
                        <div className="text-center px-4"><p className="text-lg font-black text-indigo-300 uppercase tracking-tighter italic">모든 미션 클리어!</p><p className="text-[10px] text-slate-400 font-bold mt-1">스티커판을 펼쳐 스티커를 받으세요!</p></div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-3">
                      {missions.map((m) => {
                        const isCompleted = m.status === 'completed';
                        return (
                          <button key={m.id} disabled={isCompleted} onClick={() => handleStartMission(m.id)} className={`group border rounded-[24px] p-4 text-left transition-all flex items-center gap-4 ${isCompleted ? 'bg-lime-50/50 border-lime-100 opacity-60' : 'bg-white border-indigo-50 shadow-sm active:scale-95 hover:-translate-y-1 hover:shadow-lg transition-all'}`}>
                            <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 ${isCompleted ? 'bg-lime-200 text-lime-600' : 'bg-indigo-50 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-colors'}`}>
                               {isCompleted ? <ThumbsUp size={24} /> : <><span className="text-lg leading-none">{m.durationMinutes}</span><span className="text-[8px] opacity-60">분</span></>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider block w-fit mb-1 ${isCompleted ? 'bg-lime-200 text-lime-700' : 'bg-slate-100 text-slate-400'}`}>{isCompleted ? '성공' : '대기'}</span>
                              <h3 className={`text-base font-black truncate w-full ${isCompleted ? 'text-lime-700' : 'text-slate-800'}`}>{isCompleted ? getEncouragingPhrase(m.id) : m.title}</h3>
                            </div>
                            <div className={`flex flex-col items-end gap-0.5 pl-3 border-l shrink-0 ${isCompleted ? 'border-lime-200' : 'border-slate-100'}`}>
                              <Trophy size={14} className={isCompleted ? 'text-lime-500' : 'text-amber-400'} /><span className={`text-[10px] font-black truncate max-w-[60px] ${isCompleted ? 'text-lime-600' : 'text-slate-400'}`}>{m.reward}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      )}

      {mode === 'archives' && (
        <div className="min-h-screen bg-indigo-50 p-6">
          <header className="max-w-4xl mx-auto flex justify-between items-center mb-8"><h1 className="text-2xl font-black text-indigo-900 flex items-center gap-2"><History /> 성취 앨범</h1><button onClick={() => setMode('child')} className="p-2.5 rounded-xl bg-white text-slate-500 shadow-sm"><X size={20}/></button></header>
          <div className="max-w-4xl mx-auto space-y-8 pb-12">
            {archives.length === 0 ? <div className="text-center py-24 text-indigo-300 font-black text-lg italic">보관된 미션판이 없습니다.</div> : archives.map(entry => (
              <div key={entry.archivedAt} className="space-y-4 animate-in slide-in-from-bottom-4">
                <div className="flex items-center gap-3 bg-white/50 p-4 rounded-2xl border border-white"><span className="text-lg font-black text-indigo-600">{entry.monthId.split('-')[1]}월 미션판</span><span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-[10px] font-black">총 {entry.totalStickers}개!</span></div>
                <StickerBoard stickers={entry.stickers} monthId={entry.monthId} rewardConfig={rewardConfig} />
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}