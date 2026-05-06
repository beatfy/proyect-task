"use client";

import { useState } from "react";
import { Music, Instagram, ExternalLink, Headphones, Disc3 } from "lucide-react";

interface EPKData {
  artistName: string;
  bio: string | null;
  photoUrl: string | null;
  coverUrl: string | null;
  soundcloudUrl: string | null;
  spotifyUrl: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  tracks: { title: string; url: string }[] | null;
  highlights: string[] | null;
}

export default function EPKViewerClient({ slug, initialData }: { slug: string; initialData: EPKData }) {
  const [data] = useState<EPKData>(initialData);

  return (
    <div className="min-h-screen bg-black text-white">
      {data.coverUrl && (
        <div className="relative h-[50vh] bg-cover bg-center" style={{ backgroundImage: `url(${data.coverUrl})` }}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black" />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 -mt-32 relative z-10">
        <div className="flex items-end gap-6 mb-8">
          {data.photoUrl ? (
            <img src={data.photoUrl} alt={data.artistName} className="w-40 h-40 rounded-full object-cover border-4 border-black shadow-2xl" />
          ) : (
            <div className="w-40 h-40 rounded-full bg-neutral-800 border-4 border-black flex items-center justify-center">
              <Music className="w-16 h-16 text-neutral-500" />
            </div>
          )}
          <div>
            <h1 className="text-5xl font-bold mb-2">{data.artistName}</h1>
            <div className="flex items-center gap-4">
              {data.soundcloudUrl && <a href={data.soundcloudUrl} target="_blank" className="text-neutral-400 hover:text-white transition-colors"><Headphones className="w-5 h-5" /></a>}
              {data.spotifyUrl && <a href={data.spotifyUrl} target="_blank" className="text-neutral-400 hover:text-green-400 transition-colors"><Disc3 className="w-5 h-5" /></a>}
              {data.instagramUrl && <a href={data.instagramUrl} target="_blank" className="text-neutral-400 hover:text-pink-400 transition-colors"><Instagram className="w-5 h-5" /></a>}
              {data.websiteUrl && <a href={data.websiteUrl} target="_blank" className="text-neutral-400 hover:text-white transition-colors"><ExternalLink className="w-5 h-5" /></a>}
            </div>
          </div>
        </div>

        {data.bio && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-3 border-b border-neutral-800 pb-2">Bio</h2>
            <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap">{data.bio}</p>
          </section>
        )}

        {data.highlights && data.highlights.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-3 border-b border-neutral-800 pb-2">Highlights</h2>
            <ul className="space-y-2">
              {data.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-neutral-300">
                  <span className="text-green-400 mt-1">▸</span> {h}
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.tracks && data.tracks.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-3 border-b border-neutral-800 pb-2">Tracks</h2>
            <div className="space-y-3">
              {data.tracks.map((track, i) => (
                <a key={i} href={track.url} target="_blank" className="flex items-center gap-3 p-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 transition-colors">
                  <div className="w-10 h-10 rounded bg-neutral-700 flex items-center justify-center">
                    <Music className="w-5 h-5 text-green-400" />
                  </div>
                  <span className="font-medium">{track.title}</span>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="text-center py-8 text-neutral-600 text-xs">
        Powered by Beatfy
      </div>
    </div>
  );
}
