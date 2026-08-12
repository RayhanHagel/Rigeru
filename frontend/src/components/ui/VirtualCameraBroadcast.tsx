import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/utils";

interface VirtualCameraBroadcastProps {
  sourceRef: React.RefObject<HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null>;
  isStreamActive: boolean;
  width?: number;
  height?: number;
  mode?: "frontend" | "backend";
}

export function VirtualCameraBroadcast({ 
  sourceRef, 
  isStreamActive,
  width = 640,
  height = 480,
  mode = "frontend"
}: VirtualCameraBroadcastProps) {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [showObsWarning, setShowObsWarning] = useState(false);
  const [hidePreview, setHidePreview] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastBroadcastTimeRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Stop broadcast if the upstream stream stops
  useEffect(() => {
    if (!isStreamActive && isBroadcasting) {
      stopBroadcast();
    }
  }, [isStreamActive, isBroadcasting]);

  useEffect(() => {
    return () => {
      stopBroadcast();
    };
  }, []);

  const stopBroadcast = async () => {
    if (mode === "backend") {
      try {
        const token = localStorage.getItem("auth_token") || "";
        await fetch("http://localhost:8000/api/virtual-camera/toggle-backend", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ active: false, width, height })
        });
      } catch (err) {}
      setIsBroadcasting(false);
      return;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    setIsBroadcasting(false);
  };

  const startBroadcast = async () => {
    if (!sourceRef.current) return;
    
    try {
      const token = localStorage.getItem("auth_token") || "";
      const res = await fetch("http://localhost:8000/api/virtual-camera/status", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.available) {
        setShowObsWarning(true);
        return;
      }
    } catch (err) {
      console.error("Failed to check OBS status", err);
      alert("Backend not reachable.");
      return;
    }

    setShowObsWarning(false);
    
    if (mode === "backend") {
      try {
        const token = localStorage.getItem("auth_token") || "";
        const toggleRes = await fetch("http://localhost:8000/api/virtual-camera/toggle-backend", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ active: true, width, height })
        });
        const toggleData = await toggleRes.json();
        if (toggleData.status === "started") {
          setIsBroadcasting(true);
        }
      } catch (err) {
        console.error("Failed to start backend virtual camera", err);
      }
      return;
    }

    const ws = new WebSocket("ws://localhost:8000/api/virtual-camera/stream");
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ 
        width: width, 
        height: height, 
        fps: 30 
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status === "ready") {
        setIsBroadcasting(true);
        startStreamingLoop();
      }
    };
    
    ws.onclose = () => {
      setIsBroadcasting(false);
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  };

  const startStreamingLoop = () => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    }
    const ctx = canvasRef.current.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const processFrame = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      // Rate limit to ~30fps
      const now = performance.now();
      if (now - lastBroadcastTimeRef.current >= 33) {
        const source = sourceRef.current;
        if (source && (wsRef.current.bufferedAmount ?? 0) === 0) {
          try {
            // Draw source to canvas
            ctx.drawImage(source, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // Strip alpha channel (RGBA -> RGB)
            const rgbBuffer = new Uint8Array(width * height * 3);
            for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
              rgbBuffer[j] = data[i];
              rgbBuffer[j + 1] = data[i + 1];
              rgbBuffer[j + 2] = data[i + 2];
            }
            
            wsRef.current.send(rgbBuffer);
            lastBroadcastTimeRef.current = now;
          } catch (e) {
            // Might happen if source is tainted or empty
          }
        }
      }

      requestRef.current = requestAnimationFrame(processFrame);
    };

    requestRef.current = requestAnimationFrame(processFrame);
  };

  useEffect(() => {
    if (sourceRef.current) {
      if (hidePreview) {
        sourceRef.current.style.opacity = "0";
      } else {
        sourceRef.current.style.opacity = "1";
      }
    }
  }, [hidePreview, sourceRef]);

  return (
    <div className="pt-4 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--theme-text)]">OBS Virtual Camera</span>
        <button 
          onClick={() => setHidePreview(!hidePreview)}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-2 ${hidePreview ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-[var(--theme-text)] hover:text-[var(--theme-heading)]'}`}
        >
          {hidePreview ? <Icon name="visibility_off" size={14} /> : <Icon name="visibility" size={14} />}
          {hidePreview ? "Preview Hidden" : "Hide Preview"}
        </button>
      </div>
      
      {isBroadcasting ? (
        <Button 
          variant="primary" 
          className="w-full bg-red-600 hover:bg-red-700 text-[var(--theme-heading)] h-10" 
          onClick={stopBroadcast}
          icon={<Icon name="radio" size={18} />}
        >
          Stop Broadcast
        </Button>
      ) : (
        <Button 
          variant="primary" 
          className="w-full h-12 text-lg border-none !shadow-none !ring-0 !outline-none transition-colors" 
          style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}
          onClick={startBroadcast}
          disabled={!isStreamActive}
          icon={<Icon name="radio" size={18} />}
        >
          Start Broadcast to OBS
        </Button>
      )}

      {showObsWarning && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-200 space-y-3 mt-4">
          <div className="flex items-start gap-2">
            <Icon name="warning" size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <p>OBS Virtual Camera is not detected on your system.</p>
          </div>
          <Button 
            variant="secondary"
            className="w-full text-xs"
            onClick={() => window.open("https://obsproject.com/", "_blank")}
            icon={<Icon name="download" size={14} />}
          >
            Download OBS Studio
          </Button>
        </div>
      )}
    </div>
  );
}
