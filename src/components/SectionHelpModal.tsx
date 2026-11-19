'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle2,
  ShieldCheck,
  Building2,
  MapPin,
  Play,
  Pause,
  Zap,
  Check,
  Volume2,
  VolumeX,
  ArrowRight
} from 'lucide-react';
import { AppLanguage } from '@/lib/i18n';
import { useTranslations } from '@/context/LanguageContext';

export type HelpSectionType = 'verify' | 'brand_shield' | 'heatmap';

interface SectionHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: HelpSectionType;
  appLanguage?: AppLanguage;
}

const READING_BUFFER_MS = 800;

export function SectionHelpModal({ isOpen, onClose, section, appLanguage }: SectionHelpModalProps) {
  const { isPidgin: contextIsPidgin, locale } = useTranslations();
  const effectiveLang = appLanguage || locale;
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState<HelpSectionType>(section === 'heatmap' ? 'heatmap' : section === 'brand_shield' ? 'brand_shield' : 'verify');
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isPlayingDemo, setIsPlayingDemo] = useState<boolean>(false);
  const [stepProgress, setStepProgress] = useState<number>(0);
  const [voiceLang, setVoiceLang] = useState<'en' | 'pcm'>(effectiveLang === 'pcm' ? 'pcm' : 'en');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const stepCardRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const isPidgin = effectiveLang === 'pcm' || voiceLang === 'pcm' || contextIsPidgin;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setActiveSection(section === 'heatmap' ? 'heatmap' : section === 'brand_shield' ? 'brand_shield' : 'verify');
    setActiveStep(1);
    setIsPlayingDemo(false);
    setStepProgress(0);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [section]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
    return () => {
      document.body.style.overflow = '';
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen]);

  const speakStep = (stepNum: number, onSpeechEnd?: () => void) => {
    if (isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onSpeechEnd) onSpeechEnd();
      return;
    }

    window.speechSynthesis.cancel();

    const secData = getSectionData();
    const currentStepObj = secData.steps.find((s) => s.step === stepNum);
    if (!currentStepObj) {
      if (onSpeechEnd) onSpeechEnd();
      return;
    }

    const rawSpeechText = `Step ${currentStepObj.step}: ${currentStepObj.title}. ${currentStepObj.desc}`;
    const speechText = rawSpeechText
      .replace(/\bINEC\b/g, 'Eye-neck')
      .replace(/\bCBN\b/g, 'C B N')
      .replace(/\bNCDC\b/g, 'N C D C')
      .replace(/\bWAEC\b/g, 'Why-eck')
      .replace(/\bJAMB\b/g, 'Jamb')
      .replace(/\bGTBank\b/g, 'G T Bank');

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = 0.92;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en-NG') || v.lang.startsWith('en-GB') || v.lang.startsWith('en'));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    let callbackFired = false;
    const triggerEndOnce = () => {
      if (!callbackFired) {
        callbackFired = true;
        if (onSpeechEnd) onSpeechEnd();
      }
    };

    utterance.onend = triggerEndOnce;
    utterance.onerror = triggerEndOnce;

    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!isPlayingDemo) {
      setStepProgress(0);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    const activeEl = stepCardRefs.current[activeStep];
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }

    setStepProgress(0);
    const startTime = Date.now();
    let speechDone = false;
    let speechEndTime = 0;

    const useVoice = !isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window;
    const postSpeechBufferMs = useVoice ? READING_BUFFER_MS : 1200;

    speakStep(activeStep, () => {
      speechDone = true;
      speechEndTime = Date.now();
    });

    const progressInterval = setInterval(() => {
      const now = Date.now();

      if (!speechDone) {
        const elapsed = now - startTime;
        const speechProgress = Math.min((elapsed / 6000) * 70, 70);
        setStepProgress(speechProgress);
      } else {
        const postElapsed = now - (speechEndTime || startTime);
        const postProgress = useVoice
          ? 70 + Math.min((postElapsed / postSpeechBufferMs) * 30, 30)
          : Math.min((postElapsed / postSpeechBufferMs) * 100, 100);

        setStepProgress(postProgress);

        if (postElapsed >= postSpeechBufferMs) {
          clearInterval(progressInterval);
          if (activeStep < 4) {
            setActiveStep((prev) => prev + 1);
          } else {
            setIsPlayingDemo(false);
            setStepProgress(100);
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
              window.speechSynthesis.cancel();
            }
          }
        }
      }
    }, 50);

    return () => {
      clearInterval(progressInterval);
    };
  }, [isPlayingDemo, activeStep, voiceLang, isMuted]);

  if (!isOpen || !mounted) return null;

  const getSectionData = () => {
    switch (activeSection) {
      case 'verify':
        return {
          title: isPidgin ? 'How to Check Tori' : 'Claim Verification Guide',
          subtitle: '',
          icon: <ShieldCheck className="w-5 h-5 text-[#005b9c]" />,
          steps: [
            {
              step: 1,
              title: isPidgin ? 'Input Claim or Link' : 'Input Claim or Link',
              desc: isPidgin
                ? 'Copy and paste any claim or post from WhatsApp, X, TikTok, link, or tap the microphone 🎤 to talk.'
                : 'Paste viral text, post link, WhatsApp message, or tap the microphone 🎤 to speak.',
              mockup: (
                <div className="p-2.5 rounded-xl bg-[#f4f8fc] border border-[#d5e7fa] space-y-1.5 font-mono text-[10px]">
                  <div className="flex items-center justify-between text-[#4a6076]">
                    <span>STEP 1: INPUT CLAIM / LINK</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-[#d5e7fa] text-[#0b2540] flex items-center justify-between gap-2 shadow-2xs">
                    <span className="truncate text-[#4a6076] text-xs">"CBN orders immediate shutdown of bank apps..."</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-6 h-6 rounded-lg bg-[#e6f1f8] text-[#005b9c] flex items-center justify-center text-xs">🎤</span>
                      <span className="w-6 h-6 rounded-lg bg-[#0fbf4d] text-white flex items-center justify-center font-bold text-xs">➔</span>
                    </div>
                  </div>
                </div>
              )
            },
            {
              step: 2,
              title: isPidgin ? 'Paste Screenshot' : 'Paste Screenshot',
              desc: isPidgin
                ? 'You fit also upload or paste screenshot of WhatsApp memo or tweet.'
                : 'Attach or paste a screenshot of any message or social post.',
              mockup: (
                <div className="p-2.5 rounded-xl bg-[#f4f8fc] border border-[#d5e7fa] space-y-1.5 font-mono text-[10px]">
                  <div className="flex items-center justify-between text-[#4a6076]">
                    <span>STEP 2: SCREENSHOT ATTACHMENT</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-[#005b9c]/30 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#e6f1f8] text-[#005b9c] flex items-center justify-center font-bold text-xs">🖼️</div>
                      <span className="text-[#0b2540] text-xs font-semibold">screenshot.png</span>
                    </div>
                    <span className="text-[#0fbf4d] font-bold text-[10px]">ATTACHED</span>
                  </div>
                </div>
              )
            },
            {
              step: 3,
              title: isPidgin ? 'Live Regulator Check' : 'Live Regulator Check',
              desc: isPidgin
                ? 'Our engine checks official government registries and certified fact-checkers in real time.'
                : 'Queries official government gazettes, certified regulators, and live fact-check registries.',
              mockup: (
                <div className="p-2.5 rounded-xl bg-[#f4f8fc] border border-[#d5e7fa] space-y-1.5 font-mono text-[10px]">
                  <div className="flex items-center justify-between text-[#4a6076]">
                    <span>STEP 3: LIVE REGULATOR CHECK</span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#0fbf4d] text-white font-bold flex items-center justify-between shadow-xs">
                    <span className="flex items-center gap-1.5 text-xs">⚡ VERIFY CLAIM</span>
                    <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded">CHECKING</span>
                  </div>
                </div>
              )
            },
            {
              step: 4,
              title: isPidgin ? 'Review Verdict and Sources' : 'Review Verdict and Sources',
              desc: isPidgin
                ? 'See clear verdict badge with verified source citations and audio summary.'
                : 'Examine official verdict, verified source citations, and listen to local language audio.',
              mockup: (
                <div className="p-2.5 rounded-xl bg-[#f4f8fc] border border-[#d5e7fa] space-y-1.5 font-mono text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs">CONTRADICTED</span>
                    <span className="text-[#005b9c] text-[10px] font-semibold">Official Gazette</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white border border-[#d5e7fa] text-[#0b2540] flex items-center justify-between shadow-2xs">
                    <span className="text-xs">🔊 Audio Fact-Check</span>
                    <span className="text-[#0fbf4d] font-bold text-xs">▶ PLAY</span>
                  </div>
                </div>
              )
            }
          ]
        };

      case 'brand_shield':
        return {
          title: isPidgin ? 'How to Protect Company & Creator (Brand Shield Guide)' : 'How to Use Brand & Creator Shield',
          subtitle: isPidgin
            ? 'Track rumors targeting your company, bank, creator brand, or public figure and generate 1-click PR debunk kits.'
            : 'Monitor live disinformation threats targeting corporations, public figures, and institutions in real-time.',
          icon: <Building2 className="w-5 h-5 text-[#005b9c]" />,
          steps: [
            {
              step: 1,
              title: isPidgin ? 'Enter Brand / Company Name' : 'Specify Entity Name',
              desc: isPidgin
                ? 'Type any company name like GTBank, Kuda, Davido, Air Peace, or choose from our quick presets.'
                : 'Enter any Nigerian corporate brand, public figure, bank, or state agency name in the search bar.',
              mockup: (
                <div className="p-2.5 rounded-xl bg-[#f4f8fc] border border-[#d5e7fa] space-y-1.5 font-mono text-[10px]">
                  <div className="flex items-center justify-between text-[#4a6076]">
                    <span>STEP 1: BRAND SEARCH BAR</span>
                    <span className="text-[#005b9c]">Presets: GTBank, Kuda</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-[#d5e7fa] text-[#0b2540] font-bold flex justify-between shadow-2xs">
                    <span>🔍 "GTBank Nigeria"</span>
                    <span className="text-[#005b9c]">SELECTED</span>
                  </div>
                </div>
              )
            },
            {
              step: 2,
              title: isPidgin ? 'Select Category' : 'Choose Entity Category',
              desc: isPidgin
                ? 'Select whether e be Corporation & Banks, Content Creator & Celebrity, or Government Agency.'
                : 'Filter telemetry by Corporation/Bank, Creator/Public Figure, or Government Agency.',
              mockup: (
                <div className="p-2.5 rounded-xl bg-[#f4f8fc] border border-[#d5e7fa] space-y-1.5 font-mono text-[10px]">
                  <div className="flex items-center justify-between text-[#4a6076]">
                    <span>STEP 2: CATEGORY SELECTOR</span>
                    <span className="text-[#005b9c]">3 Telemetry Pools</span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-[#005b9c] text-white font-bold">Corporation/Bank ✓</span>
                    <span className="px-2 py-0.5 rounded bg-white text-[#4a6076] border border-[#d5e7fa]">Creator/Celebrity</span>
                  </div>
                </div>
              )
            },
            {
              step: 3,
              title: isPidgin ? 'Scan Viral Social Signals' : 'Analyze Social Threat Radar',
              desc: isPidgin
                ? 'Click "Scan Brand Signals". Our radar checks viral X tweets, WhatsApp broadcast groups, and news desks.'
                : 'Click "Scan Brand Signals" to evaluate sentiment, misinfo velocity, and threat severity index.',
              mockup: (
                <div className="p-2.5 rounded-xl bg-[#f4f8fc] border border-[#d5e7fa] space-y-1.5 font-mono text-[10px]">
                  <div className="flex items-center justify-between text-[#4a6076]">
                    <span>STEP 3: THREAT & SENTIMENT RADAR</span>
                    <span className="text-emerald-700 font-bold">94% Positive (Safe)</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-[#005b9c] h-full w-[94%]" />
                  </div>
                </div>
              )
            },
            {
              step: 4,
              title: isPidgin ? 'Generate 1-Click PR Kit' : 'Deploy 1-Click PR Debunk Kit',
              desc: isPidgin
                ? 'Click PR Debunk Kit to copy ready-made official press release, WhatsApp crisis text, and X thread.'
                : 'Generate pre-formatted official debunk statements for WhatsApp, X (Twitter), press releases, and LinkedIn.',
              mockup: (
                <div className="p-2.5 rounded-xl bg-[#f4f8fc] border border-[#d5e7fa] space-y-1.5 font-mono text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#005b9c] font-bold">✨ 1-CLICK AI PR DEBUNK KIT</span>
                    <span className="bg-[#005b9c] text-white font-bold px-2 py-0.5 rounded">COPY KIT</span>
                  </div>
                  <p className="text-[#4a6076] text-[9.5px]">Pre-written press statements for WhatsApp, Twitter & Press releases.</p>
                </div>
              )
            }
          ]
        };

      case 'heatmap':
        return {
          title: isPidgin ? 'How to Use Naija State Alert Map (Geo Heatmap Guide)' : 'How to Use Geopolitical Rumor Heatmap',
          subtitle: isPidgin
            ? 'See live rumor spikes across all 36 states and Abuja in real-time.'
            : 'Track state-by-state misinformation velocity, geopolitical threat indices, and local alerts.',
          icon: <MapPin className="w-5 h-5 text-[#005b9c]" />,
          steps: [
            {
              step: 1,
              title: isPidgin ? 'Explore Nigeria Map' : 'Inspect Geopolitical Map',
              desc: isPidgin
                ? 'Look at the interactive map showing all 6 zones (South West, North Central, South East, etc.).'
                : 'Examine the interactive vector map spanning all 36 Nigerian states and FCT Abuja.',
              mockup: (
                <div className="p-2.5 rounded-xl bg-[#f4f8fc] border border-[#d5e7fa] space-y-1.5 font-mono text-[10px]">
                  <div className="flex items-center justify-between text-[#4a6076]">
                    <span>STEP 1: NIGERIA GEOPOLITICAL MAP</span>
                    <span className="text-[#005b9c]">6 Geo Zones</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-[#d5e7fa] text-[#0b2540] flex justify-between shadow-2xs">
                    <span>🗺️ 36 States + FCT Real-Time Boundary Map</span>
                    <span className="text-emerald-700 font-bold">LIVE</span>
                  </div>
                </div>
              )
            },
            {
              step: 2,
              title: isPidgin ? 'Click Any State' : 'Select State / Region',
              desc: isPidgin
                ? 'Tap on Lagos, Kano, Rivers, or any state to see the trending fake news circulating there.'
                : 'Select any state to open localized telemetry, active threat count, and regional viral claims.',
              mockup: (
                <div className="p-2.5 rounded-xl bg-[#f4f8fc] border border-[#d5e7fa] space-y-1.5 font-mono text-[10px]">
                  <div className="flex items-center justify-between text-[#4a6076]">
                    <span>STEP 2: STATE TELEMETRY</span>
                    <span className="text-[#005b9c]">Selected: Lagos State</span>
                  </div>
                  <div className="p-1.5 bg-white rounded border border-[#d5e7fa] text-[#0b2540] flex justify-between">
                    <span>Lagos State: 4 Viral Claims</span>
                    <span className="text-amber-600 font-bold">AMBER ALERT</span>
                  </div>
                </div>
              )
            },
            {
              step: 3,
              title: isPidgin ? 'Filter by Zone' : 'Filter by Geopolitical Zone',
              desc: isPidgin
                ? 'Use the zone buttons (SW, NC, NW, NE, SS, SE) to focus on specific regions.'
                : 'Filter disinformation alerts across Nigeria\'s 6 geopolitical zones with real contour mapping.',
              mockup: (
                <div className="p-2.5 rounded-xl bg-[#f4f8fc] border border-[#d5e7fa] space-y-1.5 font-mono text-[10px]">
                  <div className="flex items-center justify-between text-[#4a6076]">
                    <span>STEP 3: ZONE TOGGLE</span>
                    <span className="text-[#005b9c]">North Central Active</span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-[#005b9c] text-white font-bold">North Central</span>
                    <span className="px-2 py-0.5 rounded bg-white text-[#4a6076] border border-[#d5e7fa]">South West</span>
                  </div>
                </div>
              )
            },
            {
              step: 4,
              title: isPidgin ? 'Verify Directly from Map' : 'One-Click Verify from Heatmap',
              desc: isPidgin
                ? 'Tap any circulating state rumor to immediately run it through the Claim Verification Engine.'
                : 'Click any trending rumor from a state feed to automatically load and verify it in the Claim Engine.',
              mockup: (
                <div className="p-2.5 rounded-xl bg-[#f4f8fc] border border-[#d5e7fa] space-y-1.5 font-mono text-[10px]">
                  <div className="flex items-center justify-between text-[#4a6076]">
                    <span>STEP 4: INSTANT VERIFY LINK</span>
                    <span className="text-emerald-700 font-bold">Direct Handoff</span>
                  </div>
                  <div className="p-2 rounded bg-[#005b9c] text-white font-bold flex justify-between shadow-xs">
                    <span>⚡ Check "Port Harcourt Refinery..." Claim</span>
                    <span>→</span>
                  </div>
                </div>
              )
            }
          ]
        };
    }
  };

  const data = getSectionData();
  const currentStepData = data.steps.find((s) => s.step === activeStep) || data.steps[0];

  const modalElement = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-[24px] sm:rounded-[28px] overflow-hidden my-4 sm:my-8 bg-white border border-[#D5E7FA] shadow-2xl text-[#0b2540] max-h-[92dvh] flex flex-col animate-in zoom-in-95 duration-200"
        style={{
          background: `
            radial-gradient(circle at 10% 0%, rgba(234,243,252,0.9), transparent 50%),
            linear-gradient(180deg, #ffffff 0%, #f4f8fc 100%)
          `
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-[#D5E7FA] flex items-center justify-between bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF3FC] border border-[#D5E7FA] flex items-center justify-center shrink-0 text-[#005b9c]">
              {data.icon}
            </div>
            <div>
              <h2 className="text-base sm:text-xl font-bold text-[#0b2540] tracking-tight">
                {data.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0b2540] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-4 sm:space-y-5 text-sm scrollbar-none">
          {/* Animated Progress & Controls: Language Choice + Auto-Play Demo Only */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-white border border-[#D5E7FA] shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-[#005b9c] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#005b9c]" />
                Step {activeStep} of 4 ({(activeStep / 4) * 100}%)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVoiceLang(voiceLang === 'pcm' ? 'en' : 'pcm')}
                  className="px-2.5 py-1 rounded-xl bg-[#e6f1f8] hover:bg-[#d9ecfa] text-[#005b9c] text-[11px] font-bold border border-[#d5e7fa] transition-colors cursor-pointer"
                >
                  {voiceLang === 'pcm' ? '🇳🇬 NAIJA PIDGIN' : '🇬🇧 ENGLISH'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title={isMuted ? 'Unmute Voice' : 'Mute Voice'}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5 text-[#005b9c]" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isPlayingDemo) {
                      setIsPlayingDemo(false);
                    } else {
                      if (activeStep >= 4) setActiveStep(1);
                      setIsPlayingDemo(true);
                    }
                  }}
                  className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isPlayingDemo
                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                      : 'bg-[#e6f1f8] hover:bg-[#d9ecfa] text-[#005b9c] border border-[#d5e7fa]'
                  }`}
                >
                  {isPlayingDemo ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                  <span>{isPlayingDemo ? 'Pause Demo' : 'Auto-Play Demo'}</span>
                </button>
              </div>
            </div>

            {/* Total Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#0fbf4d] h-full transition-all duration-300 rounded-full"
                style={{ width: `${(activeStep / 4) * 100}%` }}
              />
            </div>
          </div>

          {/* Interactive Step Cards */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-[#005b9c] uppercase tracking-wider">
              {isPidgin ? 'Select any step to view details:' : 'Select any step to inspect details:'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {data.steps.map((s) => {
                const isActive = activeStep === s.step;

                return (
                  <div
                    key={s.step}
                    ref={(el) => { stepCardRefs.current[s.step] = el; }}
                    onClick={() => {
                      setActiveStep(s.step);
                      setIsPlayingDemo(false);
                      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                      }
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 relative ${
                      isActive
                        ? 'bg-white border-2 border-[#005b9c] shadow-md ring-2 ring-[#005b9c]/15'
                        : 'bg-white/80 border-[#d5e7fa] hover:border-[#005b9c]/40 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-[#005b9c] text-white'
                              : 'bg-[#e6f1f8] text-[#005b9c]'
                          }`}
                        >
                          {s.step}
                        </span>
                        <h4 className="font-bold text-xs text-[#0b2540] truncate">{s.title}</h4>
                      </div>
                      {isActive && (
                        <span className="text-[9px] font-bold uppercase bg-[#e6f1f8] text-[#005b9c] px-2 py-0.5 rounded-full border border-[#d5e7fa] shrink-0">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-[#4a6076] leading-relaxed">
                      {s.desc}
                    </p>

                    {s.mockup && (
                      <div className="pt-1 w-full overflow-hidden">
                        {s.mockup}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 border-t border-[#D5E7FA] flex justify-end">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#005b9c] hover:bg-[#00406e] text-white font-semibold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isPidgin ? 'Got It! Start Using Tool' : 'Got It! Proceed to Tool'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
}
