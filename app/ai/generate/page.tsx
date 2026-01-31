"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [style, setStyle] = useState('Default');
  const [aspectRatio, setAspectRatio] = useState('Default');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError('Please enter a description');
      return;
    }

    setLoading(true);
    setError('');
    setImageUrl('');
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style, aspectRatio })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate image');
      if (data.success && data.image) setImageUrl(data.image);
      else throw new Error('No image received from the server');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate image. Please try again.';
      setError(errorMessage);
      console.error('Generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center px-2">
      <div className="w-full max-w-lg bg-white/90 rounded-3xl shadow-2xl p-8 border border-gray-100">
        <h1 className="text-4xl font-extrabold text-center text-purple-700 mb-8 drop-shadow">AI Image Generator</h1>
        <div className="space-y-6">
          <div>
            <label className="block text-md font-semibold text-gray-700 mb-2">Image Description</label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your dream image..."
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 transition bg-white text-gray-900 placeholder-gray-400 font-medium"
              autoComplete="off"
              disabled={loading}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-600 mb-1">Style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white text-gray-900 font-medium"
                disabled={loading}
              >
                <option value="Default">Default</option>
                <option value="Anime">Anime</option>
                <option value="Realistic">Realistic</option>
                <option value="Cyberpunk">Cyberpunk</option>
                <option value="Pixel Art">Pixel Art</option>
                <option value="Fantasy">Fantasy</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-600 mb-1">Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white text-gray-900 font-medium"
                disabled={loading}
              >
                <option value="Default">Default</option>
                <option value="16:9">16:9</option>
                <option value="1:1">1:1</option>
                <option value="9:16">9:16</option>
                <option value="4:5">4:5</option>
              </select>
            </div>
          </div>
          <button
            onClick={generateImage}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl shadow-lg hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </span>
            ) : 'Generate Image'}
          </button>
          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-center font-semibold shadow">
              {error}
            </div>
          )}
          <div className="mt-6">
            {imageUrl && (
              <div className="relative flex flex-col items-center">
                <Image
                  src={imageUrl}
                  alt="Generated"
                  width={1024}
                  height={1024}
                  className="w-full rounded-2xl shadow-xl border border-gray-200"
                  style={{ maxHeight: 400, objectFit: 'contain' }}
                  onError={() => {
                    setError('Failed to load the generated image');
                    setImageUrl('');
                  }}
                  unoptimized
                  priority={false}
                />
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-sm text-purple-600 underline hover:text-pink-500 transition"
                >
                  Open Full Image
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


