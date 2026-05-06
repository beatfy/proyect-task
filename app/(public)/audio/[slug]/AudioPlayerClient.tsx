"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Music, Headphones, AlertCircle } from "lucide-react";

export default function AudioPlayerClient({ slug, title, artistName, fileUrl }: { slug: string; title: string; artistName: string; fileUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tracked, setTracked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);
    const onError = () => setError("No se pudo cargar el audio");
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      await audio.play();
      setPlaying(true);
      if (!tracked) {
        setTracked(true);
        fetch(`/api/audio-vault/${slug}`, { method: "POST" }).catch(() => {});
      }
    }
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-neutral-900 rounded-2xl p-8 border border-neutral-800">
          <div className="text-center mb-6">
            <div className="w-24 h-24 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <Music className="w-12 h-12 text-purple-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-1">{title}</h1>
            <p className="text-neutral-400 text-sm">por {artistName}</p>
          </div>

          <audio ref={audioRef} src={fileUrl} preload="metadata" />

          {error ? (
            <div className="text-center text-red-400 text-sm flex items-center justify-center gap-2">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <button onClick={toggle} className="w-14 h-14 rounded-full bg-purple-500 hover:bg-purple-600 text-white flex items-center justify-center flex-shrink-0 transition-colors">
                  {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
                </button>
                <div className="flex-1">
                  <div className="w-full bg-neutral-700 rounded-full h-2 cursor-pointer" onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    if (audioRef.current && duration) audioRef.current.currentTime = pct * duration;
                  }}>
                    <div className="h-2 rounded-full bg-purple-500 transition-all" style={{ width: duration ? `${(progress / duration) * 100}%` : "0%" }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-neutral-500">{formatTime(progress)}</span>
                    <span className="text-xs text-neutral-500">{formatTime(duration)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 mt-6 text-neutral-600 text-xs">
            <Headphones className="h-3 w-3" /> Powered by Beatfy
          </div>
        </div>
      </div>
    </div>
  );
}
