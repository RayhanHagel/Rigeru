"use client";

import React, { useState, useEffect, useRef } from "react";


import { Button } from "@/components/ui/Button";
import { ModernTabs, ModernTabContent } from "@/components/ui/ModernTabs";
import { Icon } from "@/lib/utils";

export default function QrCodePage() {
  const [activeTab, setActiveTab] = useState<"generate" | "scan">("generate");
  
  // Generator State
  const [qrText, setQrText] = useState("");
  const [fillColor, setFillColor] = useState("#000000");
  const [backColor, setBackColor] = useState("#ffffff");
  const [qrResult, setQrResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Scanner State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState("");
  const [scanError, setScanError] = useState("");
  const scanInterval = useRef<any>(null);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleGenerate = async () => {
    if (!qrText) return;
    setIsGenerating(true);
    try {
      const token = localStorage.getItem("auth_token") || "";
      const res = await fetch("http://localhost:8000/api/lifestyle/qr-generate", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({
          text: qrText,
          fill_color: fillColor,
          back_color: backColor
        })
      });
      if (!res.ok) throw new Error("Failed to generate QR code");
      const data = await res.json();
      setQrResult(data.data_url);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const startScanner = async () => {
    setScanResult("");
    setScanError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsScanning(true);
        
        scanInterval.current = setInterval(captureAndScan, 1000);
      }
    } catch (e) {
      setScanError("Could not access camera. Please check permissions.");
    }
  };

  const stopScanner = () => {
    if (scanInterval.current) clearInterval(scanInterval.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    
    try {
      const token = localStorage.getItem("auth_token") || "";
      const res = await fetch("http://localhost:8000/api/lifestyle/qr-scan", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ image: dataUrl })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          setScanResult(data.text);
          stopScanner();
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-primary/30 pb-4 shrink-0">
        <div className="flex items-center gap-0">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">QR Code Tools</h1>
            <p className="text-zinc-400 text-sm font-medium">Generate custom QR codes or scan them instantly using your webcam.</p>
          </div>
        </div>
        
        <ModernTabs 
          activeTab={activeTab}
          setActiveTab={(id) => { setActiveTab(id as any); if(id === "generate") stopScanner(); }}
          tabs={[
            { id: "generate", label: "Generator" },
            { id: "scan", label: "Scanner" }
          ]}
        />
      </div>

      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl backdrop-blur-sm w-full">
        
        {activeTab === "generate" && (
          <div className="flex flex-col gap-8 w-full">
            <div className="space-y-6 w-full">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Content to Encode</label>
                <textarea 
                  value={qrText}
                  onChange={(e) => setQrText(e.target.value)}
                  placeholder="Enter a URL, text, or contact info..."
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-white focus:border-primary outline-none min-h-[120px] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                    <Icon name="tune" size={14} /> Foreground Color
                  </label>
                  <div className="flex items-center gap-3 bg-zinc-950 border border-white/10 rounded-xl p-2 pr-4">
                    <input 
                      type="color" 
                      value={fillColor} 
                      onChange={(e) => setFillColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="font-mono text-xs text-zinc-400">{fillColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                    <Icon name="tune" size={14} /> Background Color
                  </label>
                  <div className="flex items-center gap-3 bg-zinc-950 border border-white/10 rounded-xl p-2 pr-4">
                    <input 
                      type="color" 
                      value={backColor} 
                      onChange={(e) => setBackColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="font-mono text-xs text-zinc-400">{backColor}</span>
                  </div>
                </div>
              </div>

              <Button variant="primary" className="w-full md:w-auto" onClick={handleGenerate} isLoading={isGenerating} disabled={!qrText}>
                Generate QR Code
              </Button>
            </div>

            <div className="flex flex-col items-center justify-center min-h-[300px] bg-zinc-950/50 rounded-xl border border-white/10 p-8 relative w-full">
              {qrResult ? (
                <div className="flex flex-col items-center gap-6 animate-slide-up">
                  <div className="bg-white p-4 rounded-xl shadow-2xl">
                    <img src={qrResult} alt="QR Code" className="w-64 h-64 object-contain" />
                  </div>
                  <Button 
                    variant="secondary" 
                    icon={<Icon name="download" size={16} />}
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = qrResult;
                      a.download = "qrcode.png";
                      a.click();
                    }}
                  >
                    Download Image
                  </Button>
                </div>
              ) : (
                <div className="text-zinc-600 flex flex-col items-center gap-3">
                  <Icon name="qr_code_2" size={48} className="opacity-50" />
                  <p>Your QR code will appear here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "scan" && (
          <div className="flex flex-col items-center">
            
            {scanResult ? (
              <div className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-8 flex flex-col items-center text-center animate-slide-up gap-6">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-2">
                  <Icon name="qr_code_2" size={32} />
                </div>
                <div>
                  <h3 className="text-emerald-400 font-semibold mb-2">Scan Successful!</h3>
                  <div className="bg-black/40 text-white font-mono text-sm p-4 rounded-lg break-all select-all inline-block border border-white/5">
                    {scanResult}
                  </div>
                </div>
                <div className="flex gap-4">
                  {scanResult.startsWith("http") && (
                    <Button variant="primary" onClick={() => window.open(scanResult, "_blank")}>
                      Open Link
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => { setScanResult(""); startScanner(); }}>
                    Scan Another
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full">
                <div className="relative bg-black rounded-2xl overflow-hidden border border-white/10 aspect-video flex items-center justify-center">
                  <video ref={videoRef} playsInline className="absolute inset-0 w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {!isScanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-900/80 backdrop-blur-sm z-10">
                      <Icon name="photo_camera" size={48} className="text-zinc-500" />
                      <Button variant="primary" onClick={startScanner} icon={<Icon name="photo_camera" size={16} />}>
                        Start Camera
                      </Button>
                    </div>
                  )}

                  {isScanning && (
                    <div className="absolute inset-0 pointer-events-none z-10">
                      {/* Scanning overlay frame */}
                      <div className="absolute inset-1/4 border-2 border-primary/50 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl"></div>
                        <div className="w-full h-0.5 bg-primary/50 animate-[scan_2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(168,85,247,1)] absolute left-0"></div>
                      </div>
                    </div>
                  )}
                </div>
                
                {isScanning && (
                  <div className="mt-6 flex justify-center">
                    <Button variant="danger" onClick={stopScanner} icon={<Icon name="cancel" size={16} />}>
                      Stop Camera
                    </Button>
                  </div>
                )}
                
                {scanError && (
                  <p className="text-red-400 text-center mt-4 text-sm bg-red-500/10 p-3 rounded-lg">{scanError}</p>
                )}
              </div>
            )}
            
          </div>
        )}

      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}} />
    </div>
  );
}
