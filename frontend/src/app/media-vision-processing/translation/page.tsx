"use client";

import React, { useState } from "react";
import { ArrowRightLeft, Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

import nllbLanguages from "@/data/nllb_languages.json";

// The JSON maps Flores-200 code (e.g. "ace_Arab") -> Human Readable Name (e.g. "Acehnese (Arabic)")
// Let's create an array of just the human readable names for the dropdown.
// To keep things clean and sorted, we sort them alphabetically.
const LANGUAGES = Object.values(nllbLanguages).sort();

export default function TranslationPage() {
  const [sourceLang, setSourceLang] = useState("English");
  const [targetLang, setTargetLang] = useState("French");
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/media-vision/translation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sourceText,
          source_lang: sourceLang,
          target_lang: targetLang
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTranslatedText(data.translated_text);
      } else {
        setErrorMsg(data.detail || "Translation failed.");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwap = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 animate-fade-in relative z-10 max-w-6xl mx-auto flex flex-col">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Languages className="text-orange-400" size={32} />
          Local AI Translation
        </h1>
        <p className="text-zinc-400 text-sm font-medium">
          Offline, privacy-preserving text translation powered by Hugging Face T5 models.
        </p>
      </div>

      <div className="flex-1 bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-6">
        {/* Controls */}
        <div className="flex items-center gap-4 justify-between md:justify-start">
          <select 
            value={sourceLang} 
            onChange={(e) => setSourceLang(e.target.value)}
            className="bg-zinc-950 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500 min-w-[150px]"
          >
            {LANGUAGES.map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>

          <button 
            onClick={handleSwap}
            className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors text-zinc-300"
            title="Swap Languages"
          >
            <ArrowRightLeft size={16} />
          </button>

          <select 
            value={targetLang} 
            onChange={(e) => setTargetLang(e.target.value)}
            className="bg-zinc-950 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500 min-w-[150px]"
          >
            {LANGUAGES.map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
            {errorMsg}
          </div>
        )}

        {/* Translation Areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-[300px]">
          {/* Source Textarea */}
          <div className="flex flex-col relative h-full">
            <textarea
              className="flex-1 bg-zinc-950 border border-white/10 rounded-xl p-4 text-white text-base resize-none focus:outline-none focus:border-orange-500/50 transition-colors"
              placeholder="Enter text to translate..."
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            />
          </div>

          {/* Target Textarea */}
          <div className="flex flex-col relative h-full">
            <div className={`flex-1 bg-zinc-950/50 border border-white/5 rounded-xl p-4 text-white text-base resize-none ${isLoading ? 'opacity-50' : ''}`}>
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                  <Loader2 className="animate-spin" size={24} />
                  <span className="ml-2 text-sm">Translating...</span>
                </div>
              ) : translatedText ? (
                <p className="whitespace-pre-wrap">{translatedText}</p>
              ) : (
                <p className="text-zinc-600 italic">Translation will appear here...</p>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleTranslate} 
            disabled={!sourceText.trim() || isLoading || sourceLang === targetLang}
            className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-8 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Translating..." : "Translate"}
          </Button>
        </div>
      </div>
    </div>
  );
}
