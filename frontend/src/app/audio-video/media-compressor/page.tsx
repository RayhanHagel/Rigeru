"use client";

import React, { useState } from 'react';
import { Header } from "@/components/ui/Header";
import { ModernTabs, ModernTabContent } from '@/components/ui/ModernTabs';
import { Container } from "@/components/ui/Container";
import { Columns, Column } from "@/components/ui/Columns";
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { Slider } from '@/components/ui/Slider';
import { Select } from '@/components/ui/Select';
import { FileExplorerModal } from '@/components/ui/FileExplorerModal';
import { DirectUploadBox } from '@/components/ui/DirectUploadBox';

export default function MediaCompressor() {
  // Video State
  const [activeTab, setActiveTab] = useState("video");
  const [vidFileInfo, setVidFileInfo] = useState<{ hash_name: string; original_name: string; file_type: string } | null>(null);
  const [vidOut, setVidOut] = useState("");
  const [startT, setStartT] = useState(0);
  const [endT, setEndT] = useState(99999);
  const [profile, setProfile] = useState("Custom Configuration");
  
  // Custom config state
  const [targetRes, setTargetRes] = useState("1080p");
  const [crf, setCrf] = useState(23);
  const [preset, setPreset] = useState("fast");
  const [keepAudio, setKeepAudio] = useState(true);
  const [audioCodec, setAudioCodec] = useState("aac");

  // Video File Explorer
  const [showVidOutPicker, setShowVidOutPicker] = useState(false);
  const [vidStatus, setVidStatus] = useState<{success: boolean, msg: string} | null>(null);
  const [vidLoading, setVidLoading] = useState(false);

  // Image State
  const [imgIn, setImgIn] = useState("");
  const [imgOut, setImgOut] = useState("");
  const [imgQuality, setImgQuality] = useState(80);
  const [imgWidth, setImgWidth] = useState(1920);
  const [imgHeight, setImgHeight] = useState(1080);
  const [fitMode, setFitMode] = useState("Maintain Aspect Ratio (Fit Inside)");

  // Image File Explorers
  const [showImgInPicker, setShowImgInPicker] = useState(false);
  const [showImgOutPicker, setShowImgOutPicker] = useState(false);
  const [imgStatus, setImgStatus] = useState<{success: boolean, msg: string} | null>(null);
  const [imgLoading, setImgLoading] = useState(false);

  const handleProcessVideo = async () => {
    if (!vidFileInfo) {
      setVidStatus({success: false, msg: "Please upload a video file."});
      return;
    }
    if (!vidOut) {
      setVidStatus({success: false, msg: "Please enter an output folder."});
      return;
    }

    setVidLoading(true);
    setVidStatus(null);
    
    // Resolve profile logic before sending
    let finalRes = targetRes;
    let finalCrf = crf;
    let finalPreset = preset;
    let finalKeepAudio = keepAudio;
    let finalAudioCodec = audioCodec;

    if (profile === "Handbrake: Fast 1080p") {
      finalRes = "1080p"; finalCrf = 22; finalPreset = "fast"; finalKeepAudio = false; finalAudioCodec = "aac";
    } else if (profile === "Handbrake: High Quality 1080p") {
      finalRes = "1080p"; finalCrf = 18; finalPreset = "slow"; finalKeepAudio = true; finalAudioCodec = "copy";
    } else if (profile === "Handbrake: Web Optimized 720p") {
      finalRes = "720p"; finalCrf = 28; finalPreset = "veryfast"; finalKeepAudio = false; finalAudioCodec = "aac";
    }

    const formData = new FormData();
    formData.append("file_hash", vidFileInfo.hash_name);
    formData.append("output_dir", vidOut);
    formData.append("start_time", startT.toString());
    formData.append("end_time", endT.toString());
    formData.append("target_res", finalRes);
    formData.append("crf", finalCrf.toString());
    formData.append("preset", finalPreset);
    formData.append("keep_audio", finalKeepAudio.toString());
    formData.append("audio_codec", finalAudioCodec);

    try {
      const res = await fetch("/api/media-vision/compress-video", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to process video");
      setVidStatus({success: true, msg: data.message});
    } catch (e: any) {
      setVidStatus({success: false, msg: e.message});
    }
    setVidLoading(false);
  };

  const handleCompressImages = async () => {
    if (!imgIn || !imgOut) {
      setImgStatus({success: false, msg: "Please specify both input and output folders."});
      return;
    }

    setImgLoading(true);
    setImgStatus(null);
    
    try {
      const res = await fetch("/api/media-vision/compress-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input_dir: imgIn,
          output_dir: imgOut,
          quality: imgQuality,
          max_width: imgWidth,
          max_height: imgHeight,
          fit_mode: fitMode
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to compress images");
      setImgStatus({success: true, msg: data.message});
    } catch (e: any) {
      setImgStatus({success: false, msg: e.message});
    }
    setImgLoading(false);
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-indigo-500/30 pb-4">
        <div className="flex items-center gap-0">
          
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Media Compressor</h1>
            <p className="text-zinc-400 text-sm font-medium">Locally trim videos and batch-compress images to save hard drive space.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <ModernTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabs={[
              { id: 'video', label: 'Video Compressor', icon: '🎥 ' },
              { id: 'image', label: 'Image Batch', icon: '🖼️ ' }
            ]}
          />
        </div>
      </div>
      <ModernTabContent activeTab={activeTab}>
          {activeTab === 'video' && (
                  <div>
                    <Container>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-zinc-300 mb-2">1. Select Input Video File</label>
                          <DirectUploadBox
                            accept=".mp4,.mkv,.mov,.avi,.wmv,.flv,.webm,.m4v"
                            label="Upload Video to Compress"
                            onUploadComplete={setVidFileInfo}
                            onClear={() => setVidFileInfo(null)}
                            defaultFileName={vidFileInfo?.original_name}
                          />
                        </div>
                        
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <TextInput
                              label="2. Output Folder"
                              value={vidOut}
                              onChange={(e) => setVidOut(e.target.value)}
                              placeholder="C:\Users\You\Videos\Compressed"
                            />
                          </div>
                          <Button variant="secondary" onClick={() => setShowVidOutPicker(true)}>Browse</Button>
                        </div>
                      </div>
                    </Container>

                    <div className="mt-6">
                      <h3 className="text-xl font-semibold text-zinc-100 mb-4">Trimming & Profile</h3>
                      
                      <Columns>
                        <Column>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">Start Time (seconds)</label>
                            <input type="number" value={startT} onChange={(e) => setStartT(Number(e.target.value))} className="w-full bg-zinc-900 border border-white/10 rounded-md p-2 text-white" min={0} />
                          </div>
                        </Column>
                        <Column>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">End Time (seconds)</label>
                            <input type="number" value={endT} onChange={(e) => setEndT(Number(e.target.value))} className="w-full bg-zinc-900 border border-white/10 rounded-md p-2 text-white" min={0} />
                          </div>
                        </Column>
                      </Columns>

                      <div className="mt-4 space-y-4">
                        <Select
                          label="Compression Profile"
                          value={profile}
                          onChange={(e) => setProfile(e.target.value)}
                          options={[
                            { value: "Custom Configuration", label: "Custom Configuration" },
                            { value: "Handbrake: Fast 1080p", label: "Handbrake: Fast 1080p" },
                            { value: "Handbrake: High Quality 1080p", label: "Handbrake: High Quality 1080p" },
                            { value: "Handbrake: Web Optimized 720p", label: "Handbrake: Web Optimized 720p" },
                          ]}
                        />

                        {profile === "Custom Configuration" ? (
                          <div className="p-4 bg-zinc-900/50 rounded-lg border border-white/5 space-y-4 mt-2">
                            <Select
                              label="Max Resolution"
                              value={targetRes}
                              onChange={(e) => setTargetRes(e.target.value)}
                              options={[
                                { value: "Keep Original", label: "Keep Original" },
                                { value: "1080p", label: "1080p" },
                                { value: "720p", label: "720p" },
                                { value: "480p", label: "480p" },
                              ]}
                            />
                            
                            <Columns>
                              <Column>
                                <Slider
                                  label="CRF Quality (Lower = Better/Larger File)"
                                  min={0} max={51} value={crf}
                                  onChange={setCrf}
                                />
                              </Column>
                              <Column>
                                <Select
                                  label="Encoding Speed Preset"
                                  value={preset}
                                  onChange={(e) => setPreset(e.target.value)}
                                  options={[
                                    { value: "ultrafast", label: "ultrafast" },
                                    { value: "superfast", label: "superfast" },
                                    { value: "veryfast", label: "veryfast" },
                                    { value: "faster", label: "faster" },
                                    { value: "fast", label: "fast" },
                                    { value: "medium", label: "medium" },
                                    { value: "slow", label: "slow" },
                                    { value: "slower", label: "slower" },
                                    { value: "veryslow", label: "veryslow" },
                                  ]}
                                />
                              </Column>
                            </Columns>

                            <Columns>
                              <Column>
                                <label className="flex items-center space-x-2 text-sm text-zinc-300 mt-8">
                                  <input type="checkbox" checked={keepAudio} onChange={(e) => setKeepAudio(e.target.checked)} className="rounded bg-zinc-900 border-white/20" />
                                  <span>Keep All Audio Tracks (Multi-track)</span>
                                </label>
                              </Column>
                              <Column>
                                <Select
                                  label="Audio Codec"
                                  value={audioCodec}
                                  onChange={(e) => setAudioCodec(e.target.value)}
                                  options={[
                                    { value: "aac", label: "aac (Recompress)" },
                                    { value: "copy", label: "copy (Original)" },
                                  ]}
                                />
                              </Column>
                            </Columns>
                          </div>
                        ) : (
                          <div className="p-4 bg-blue-900/20 text-blue-300 rounded-md border border-secondary/20 text-sm mt-2">
                            **Loaded Preset:** Max Res: {profile.includes("1080") ? "1080p" : "720p"} | 
                            CRF: {profile.includes("Fast") ? 22 : profile.includes("High") ? 18 : 28} | 
                            Speed: {profile.includes("Fast") ? "fast" : profile.includes("High") ? "slow" : "veryfast"} | 
                            Audio: {profile.includes("High") ? "COPY" : "AAC"}
                          </div>
                        )}

                        <Button 
                          variant="primary" 
                          className="w-full mt-6" 
                          onClick={handleProcessVideo}
                          disabled={vidLoading}
                        >
                          {vidLoading ? "Processing video This might take a while." : "🚀 Process Video"}
                        </Button>

                        {vidStatus && (
                          <div className={`p-4 rounded-md mt-4 ${vidStatus.success ? 'bg-green-900/20 text-green-400 border border-green-500/20' : 'bg-red-900/20 text-red-400 border border-red-500/20'}`}>
                            {vidStatus.msg}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
          </ModernTabContent>

      <ModernTabContent activeTab={activeTab}>
          {activeTab === 'image' && (
                  <div>
                    <Container>
                      <div className="space-y-4">
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <TextInput
                              label="1. Input Image Folder"
                              value={imgIn}
                              onChange={(e) => setImgIn(e.target.value)}
                              placeholder="Full path to the folder containing images to compress."
                            />
                          </div>
                          <Button variant="secondary" onClick={() => setShowImgInPicker(true)}>Browse</Button>
                        </div>

                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <TextInput
                              label="2. Output Image Folder"
                              value={imgOut}
                              onChange={(e) => setImgOut(e.target.value)}
                              placeholder="Full path to the folder where compressed images will be saved."
                            />
                          </div>
                          <Button variant="secondary" onClick={() => setShowImgOutPicker(true)}>Browse</Button>
                        </div>
                      </div>
                    </Container>

                    <div className="mt-6 space-y-6">
                      <h3 className="text-xl font-semibold text-zinc-100">Compression Settings</h3>
                      
                      <Slider
                        label="JPEG Quality"
                        min={10} max={100} value={imgQuality}
                        onChange={setImgQuality}
                      />

                      <Columns>
                        <Column>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">Target Box Width (px)</label>
                            <input type="number" value={imgWidth} onChange={(e) => setImgWidth(Number(e.target.value))} className="w-full bg-zinc-900 border border-white/10 rounded-md p-2 text-white" min={0} />
                            <p className="text-xs text-zinc-500">Set to 0 to ignore</p>
                          </div>
                        </Column>
                        <Column>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">Target Box Height (px)</label>
                            <input type="number" value={imgHeight} onChange={(e) => setImgHeight(Number(e.target.value))} className="w-full bg-zinc-900 border border-white/10 rounded-md p-2 text-white" min={0} />
                            <p className="text-xs text-zinc-500">Set to 0 to ignore</p>
                          </div>
                        </Column>
                      </Columns>

                      <Select
                        label="Resizing Mode (If dimensions provided)"
                        value={fitMode}
                        onChange={(e) => setFitMode(e.target.value)}
                        options={[
                          { value: "Maintain Aspect Ratio (Fit Inside)", label: "Maintain Aspect Ratio (Fit Inside)" },
                          { value: "Stretch to Fit", label: "Stretch to Fit" },
                          { value: "Pad with Black Bars", label: "Pad with Black Bars" },
                          { value: "Pad with White Bars", label: "Pad with White Bars" },
                          { value: "Pad with Blurred Background", label: "Pad with Blurred Background" },
                        ]}
                      />

                      <Button 
                        variant="primary" 
                        className="w-full mt-6" 
                        onClick={handleCompressImages}
                        disabled={imgLoading}
                      >
                        {imgLoading ? "Compressing images..." : "🚀 Batch Compress Images"}
                      </Button>

                      {imgStatus && (
                        <div className={`p-4 rounded-md mt-4 ${imgStatus.success ? 'bg-green-900/20 text-green-400 border border-green-500/20' : 'bg-red-900/20 text-red-400 border border-red-500/20'}`}>
                          {imgStatus.msg}
                        </div>
                      )}
                    </div>
                  </div>
                )}
          </ModernTabContent>

      {/* File Explorers */}
      <FileExplorerModal isOpen={showVidOutPicker} onClose={() => setShowVidOutPicker(false)} onSelect={setVidOut} title="Select Output Folder" />
      <FileExplorerModal isOpen={showImgInPicker} onClose={() => setShowImgInPicker(false)} onSelect={setImgIn} title="Select Input Folder" />
      <FileExplorerModal isOpen={showImgOutPicker} onClose={() => setShowImgOutPicker(false)} onSelect={setImgOut} title="Select Output Folder" />
    </div>
  );
}
