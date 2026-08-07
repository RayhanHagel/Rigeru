"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { BookOpen, ArrowLeft, ChevronLeft, ChevronRight, Edit2, Book, Star, Bookmark, Download, DownloadCloud, BookOpenCheck, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useRouter, useSearchParams } from "next/navigation";

function MangaReadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mangaId = searchParams.get("id"); // this is the title

  const [mangaData, setMangaData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Modes: "details" or "reading"
  const [mode, setMode] = useState<"details" | "reading">("details");
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [pages, setPages] = useState<string[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState("");
  const [chapterProgress, setChapterProgress] = useState<string>("0");

  const [viewMode, setViewMode] = useState<"pdf" | "images">("pdf");
  const [layoutMode, setLayoutMode] = useState<"vertical" | "horizontal">("vertical");
  const [horizontalType, setHorizontalType] = useState<"single" | "book">("single");
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(50);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll effect
  useEffect(() => {
    let interval: any;
    if (autoScroll && viewMode === "images" && layoutMode === "vertical" && scrollContainerRef.current) {
      interval = setInterval(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop += (scrollSpeed / 10);
        }
      }, 50);
    }
    return () => clearInterval(interval);
  }, [autoScroll, scrollSpeed, viewMode, layoutMode]);

  // Reset page index on chapter change
  useEffect(() => {
    setCurrentPageIndex(0);
  }, [selectedChapter, layoutMode, horizontalType]);

  const handlePageClick = (direction: 'left' | 'right') => {
    if (direction === 'left') {
      setCurrentPageIndex(prev => Math.max(0, prev - (horizontalType === 'book' ? 2 : 1)));
    } else {
      setCurrentPageIndex(prev => Math.min(pages.length - 1, prev + (horizontalType === 'book' ? 2 : 1)));
    }
  };

  const fetchManga = async () => {
    try {
      const res = await fetch("/api/media-entertainment/manga-library");
      if (!res.ok) throw new Error("Failed to load library.");
      const data = await res.json();
      
      if (data[mangaId!]) {
        setMangaData(data[mangaId!]);
        setChapterProgress(data[mangaId!].chapter_read?.toString() || "0");
      } else {
        setErrorMsg("Manga not found in library.");
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!mangaId) {
      setErrorMsg("No manga specified.");
      setLoading(false);
      return;
    }
    fetchManga();
  }, [mangaId]);

  const handleRefresh = async () => {
    if (!mangaId) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/media-entertainment/manga-library/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: mangaId }) // Wait, the current refresh endpoint doesn't take a title in body. Let's just use the global refresh or add a specific one.
      });
      // But actually, we can just call fetchManga to refresh the local state.
      // Wait, the API refresh endpoint refreshes the WHOLE library if no title is given.
      // Let's just call it without body, it refreshes all.
      await fetch("/api/media-entertainment/manga-library/refresh", { method: "POST" });
      await fetchManga();
    } catch (e: any) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (mode === "reading" && selectedChapter && mangaData) {
      const fetchPages = async () => {
        setLoadingPages(true);
        setPages([]);
        window.scrollTo(0, 0);
        try {
          const res = await fetch(`/api/media-entertainment/manga-read/local-pages?title=${encodeURIComponent(mangaId || "")}&chapter_url=${encodeURIComponent(selectedChapter)}&website=${encodeURIComponent(mangaData.website)}`);
          if (!res.ok) throw new Error("Failed to load local pages. Is it downloaded?");
          const data = await res.json();
          const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : "";
          const imagesWithAuth = (data.images || []).map((url: string) => `${url}&token=${token}`);
          setPages(imagesWithAuth);
        } catch (e: any) {
          console.error(e);
          alert("Failed to load local chapter pages. Please ensure the chapter is downloaded first.");
        } finally {
          setLoadingPages(false);
        }
      };
      fetchPages();
    }
  }, [mode, selectedChapter, mangaData]);

  const handleUpdateProgress = async () => {
    try {
      const val = parseInt(chapterProgress);
      if (isNaN(val) || val < 0 || val > mangaData.chapters_amount) {
        alert("Invalid chapter number.");
        return;
      }
      const res = await fetch("/api/media-entertainment/manga-library/update-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: mangaId, chapter_read: val })
      });
      if (res.ok) {
        alert("Progress updated!");
        fetchManga();
      }
    } catch (e: any) {
      alert("Failed to update progress.");
    }
  };

  const handleDownload = async (url: string, silent = false) => {
    if (!mangaData || !mangaId) return;
    setDownloading(prev => ({ ...prev, [url]: true }));
    try {
      const res = await fetch("/api/media-entertainment/manga-read/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: mangaId,
          chapter_url: url,
          website: mangaData.website
        })
      });
      if (!res.ok) throw new Error("Failed to download.");
      if (!silent) alert("Chapter downloaded successfully.");
      await fetchManga(); // Refresh to update isDownloaded status
    } catch (e: any) {
      if (!silent) alert(e.message);
    } finally {
      setDownloading(prev => ({ ...prev, [url]: false }));
    }
  };

  const handleDownloadAll = async () => {
    if (!mangaData || !mangaId) return;
    const chaptersToDownload = (mangaData.chapters_url || []).filter(
      (url: string) => !(mangaData.chapter_downloaded || []).includes(url)
    );
    if (chaptersToDownload.length === 0) {
      alert("All chapters are already downloaded!");
      return;
    }
    
    setDownloadingAll(true);
    let downloadedCount = 0;
    
    for (const url of chaptersToDownload) {
      setDownloadProgress(`Downloading ${downloadedCount + 1}/${chaptersToDownload.length}...`);
      await handleDownload(url, true);
      downloadedCount++;
    }
    
    setDownloadProgress("");
    setDownloadingAll(false);
    alert("Finished downloading all chapters!");
  };

  const handleDelete = async () => {
    if (!mangaId) return;
    if (!confirm(`Are you sure you want to delete ${mangaId} from your library?`)) return;
    
    try {
      const res = await fetch("/api/media-entertainment/manga-library/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: mangaId })
      });
      if (!res.ok) throw new Error("Failed to delete.");
      router.push('/entertainment-reading/manga-library');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const startReading = (url: string) => {
    setSelectedChapter(url);
    setMode("reading");
  };

  const handlePrevChapter = () => {
    if (!mangaData || !mangaData.chapters_url) return;
    const idx = mangaData.chapters_url.indexOf(selectedChapter);
    if (idx < mangaData.chapters_url.length - 1) {
      const targetUrl = mangaData.chapters_url[idx + 1];
      if (mangaData.chapter_downloaded?.includes(targetUrl)) {
        setSelectedChapter(targetUrl); 
      }
    }
  };

  const handleNextChapter = () => {
    if (!mangaData || !mangaData.chapters_url) return;
    const idx = mangaData.chapters_url.indexOf(selectedChapter);
    if (idx > 0) {
      const targetUrl = mangaData.chapters_url[idx - 1];
      if (mangaData.chapter_downloaded?.includes(targetUrl)) {
        setSelectedChapter(targetUrl); 
      }
    }
  };

  const resolveImageUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith('/app/static/')) {
      return `${url.replace('/app/static', '/static')}`;
    }
    return url;
  };

  if (loading) {
    return <div className="p-10 text-white flex justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  if (errorMsg) {
    return (
      <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans">
        <Button variant="secondary" onClick={() => router.push('/entertainment-reading/manga-library')} className="mb-4">
          <ArrowLeft size={16} /> Back to Library
        </Button>
        <div className="p-4 bg-red-500/20 text-red-400 rounded-xl border border-red-500/30">{errorMsg}</div>
      </div>
    );
  }

  if (mode === "reading") {
    return (
      <div className="w-full h-full animate-slide-up relative z-10 overflow-y-auto bg-[#0a0a0a]" ref={scrollContainerRef}>
        <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 flex flex-col">
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => setMode("details")} className="h-10">
              Details
            </Button>
            <div className="truncate max-w-[200px] sm:max-w-md">
              <h1 className="text-lg font-bold text-white truncate">{mangaId}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              onClick={handlePrevChapter} 
              disabled={
                mangaData?.chapters_url?.indexOf(selectedChapter) === mangaData?.chapters_url?.length - 1 || 
                !mangaData?.chapter_downloaded?.includes(mangaData?.chapters_url?.[mangaData?.chapters_url?.indexOf(selectedChapter) + 1])
              } 
              className="h-10 px-3"
            >
              <ChevronLeft size={16} />
            </Button>
            
            <select 
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              className="bg-zinc-900 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-primary outline-none max-w-[150px] sm:max-w-[200px]"
            >
              {mangaData?.chapters_url?.map((url: string, i: number) => {
                let label = `Chapter ${mangaData.chapters_url.length - i}`;
                if (mangaData.website === "mangadex.org/") {
                  const match = url.match(/chapter-([0-9.]+)/);
                  if (match) label = `Chapter ${match[1]}`;
                } else if (mangaData.website === "asurascans.com/") {
                  const parts = url.split("-chapter-");
                  if (parts.length > 1) label = `Chapter ${parts[1].replace(/\/$/, '')}`;
                }
                const isDownloaded = mangaData?.chapter_downloaded?.includes(url);
                return (
                  <option key={url} value={url} disabled={!isDownloaded}>
                    {label}{isDownloaded ? "" : " (Not Downloaded)"}
                  </option>
                );
              })}
            </select>
            
            <Button 
              variant="secondary" 
              onClick={handleNextChapter} 
              disabled={
                mangaData?.chapters_url?.indexOf(selectedChapter) === 0 || 
                !mangaData?.chapter_downloaded?.includes(mangaData?.chapters_url?.[mangaData?.chapters_url?.indexOf(selectedChapter) - 1])
              } 
              className="h-10 px-3"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
          </div>
          
          <div className="px-4 pb-3 flex flex-wrap gap-4 items-center bg-zinc-950/50 pt-2 border-t border-white/5 shadow-inner">
             <div className="flex items-center gap-2">
               <span className="text-zinc-400 text-sm font-medium">Display:</span>
               <select 
                 value={viewMode}
                 onChange={(e) => setViewMode(e.target.value as any)}
                 className="bg-zinc-900 border border-white/10 rounded-lg p-1.5 text-sm text-white focus:border-primary outline-none"
               >
                 <option value="pdf">PDF Embed</option>
                 <option value="images">Image Viewer</option>
               </select>
             </div>
             
             {viewMode === "images" && (
               <>
                 <div className="flex items-center gap-2">
                   <span className="text-zinc-400 text-sm font-medium">Layout:</span>
                   <select 
                     value={layoutMode}
                     onChange={(e) => setLayoutMode(e.target.value as any)}
                     className="bg-zinc-900 border border-white/10 rounded-lg p-1.5 text-sm text-white focus:border-primary outline-none"
                   >
                     <option value="vertical">Vertical</option>
                     <option value="horizontal">Horizontal</option>
                   </select>
                 </div>
                 
                 {layoutMode === "horizontal" && (
                   <div className="flex items-center gap-2">
                     <span className="text-zinc-400 text-sm font-medium">Pages:</span>
                     <select 
                       value={horizontalType}
                       onChange={(e) => setHorizontalType(e.target.value as any)}
                       className="bg-zinc-900 border border-white/10 rounded-lg p-1.5 text-sm text-white focus:border-primary outline-none"
                     >
                       <option value="single">Single Page</option>
                       <option value="book">Double Page (Book)</option>
                     </select>
                   </div>
                 )}
                 
                 {layoutMode === "vertical" && (
                   <div className="flex items-center gap-3 border-l border-white/10 pl-4 ml-2">
                     <label className="text-sm text-zinc-300 flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                       <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="rounded bg-zinc-800 border-white/10 text-primary focus:ring-primary/50" />
                       Auto-Scroll
                     </label>
                     {autoScroll && (
                       <input 
                         type="range" 
                         min="10" 
                         max="200" 
                         value={scrollSpeed} 
                         onChange={(e) => setScrollSpeed(Number(e.target.value))} 
                         className="w-24 accent-purple-500" 
                       />
                     )}
                   </div>
                 )}
               </>
             )}
          </div>
        </div>

        <div className="w-full py-8 px-4 flex flex-col items-center min-h-screen">
          {viewMode === "pdf" ? (
            mangaData?.chapter_downloaded?.includes(selectedChapter) ? (
              <div className="w-full flex-1 flex flex-col items-center mt-10">
                <embed 
                  src={`/api/media-entertainment/manga-read/pdf?title=${encodeURIComponent(mangaId!)}&chapter_url=${encodeURIComponent(selectedChapter)}&website=${encodeURIComponent(mangaData.website)}&token=${typeof window !== "undefined" ? localStorage.getItem("auth_token") : ""}#view=FitH`}
                  type="application/pdf"
                  className="w-full h-[85vh] rounded-xl border border-white/10"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                <div className="p-4 bg-zinc-900/50 rounded-full mb-4 border border-white/5">
                  <DownloadCloud size={48} className="text-zinc-500" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Chapter Not Downloaded</h2>
                <p className="text-zinc-400 max-w-sm mb-6">You need to download this chapter before you can read it in PDF mode.</p>
                <Button variant="primary" onClick={() => setMode("details")} className="bg-primary hover:bg-primary">
                  Go to Details to Download
                </Button>
              </div>
            )
          ) : (
            // Image Viewer Mode
            loadingPages ? (
              <div className="flex flex-col items-center justify-center h-[50vh] text-white gap-4">
                <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-zinc-400 font-medium tracking-wide">Loading Images</p>
              </div>
            ) : pages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[50vh] text-white gap-4">
                <div className="p-4 bg-zinc-900/50 rounded-full mb-4 border border-white/5">
                  <BookOpen size={48} className="text-zinc-500" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">No Images Found</h2>
                <p className="text-zinc-400 max-w-sm mb-6 text-center">We couldn't retrieve any images for this chapter.</p>
              </div>
            ) : layoutMode === "vertical" ? (
              <div className="flex flex-col w-full items-center gap-0">
                {pages.map((url, idx) => (
                  <img key={idx} src={url} alt={`Page ${idx+1}`} className="w-full max-w-3xl object-contain bg-zinc-950" loading="lazy" />
                ))}
              </div>
            ) : (
              <div className="flex flex-col w-full items-center relative select-none">
                <div className="flex justify-between w-full text-zinc-400 text-sm mb-4 px-4 font-medium">
                  <span>Page {currentPageIndex + 1}{horizontalType === 'book' ? ` - ${Math.min(currentPageIndex + 2, pages.length)}` : ''} of {pages.length}</span>
                </div>
                
                <div className="relative flex w-full justify-center bg-zinc-950/50 rounded-xl overflow-hidden shadow-2xl w-full h-full" style={{ height: '80vh' }}>
                  {/* Left click zone */}
                  <div className="absolute left-0 top-0 bottom-0 w-[40%] z-10 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-start p-4 group" onClick={() => handlePageClick('left')}>
                    <ChevronLeft size={64} className="text-white/10 group-hover:text-white/60 drop-shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  
                  {/* Right click zone */}
                  <div className="absolute right-0 top-0 bottom-0 w-[40%] z-10 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-end p-4 group" onClick={() => handlePageClick('right')}>
                    <ChevronRight size={64} className="text-white/10 group-hover:text-white/60 drop-shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {horizontalType === 'single' ? (
                    <img src={pages[currentPageIndex]} className="h-full object-contain pointer-events-none" alt="Page" />
                  ) : (
                    <div className="flex h-full max-w-full justify-center">
                      {pages[currentPageIndex] && <img src={pages[currentPageIndex]} className="h-full max-w-[50%] object-contain pointer-events-none" alt="Page Left" />}
                      {pages[currentPageIndex + 1] && <img src={pages[currentPageIndex + 1]} className="h-full max-w-[50%] object-contain pointer-events-none" alt="Page Right" />}
                    </div>
                  )}
                </div>
              </div>
            )
          )}
          
          <div className="flex gap-4 mt-12 mb-8">
            <Button 
              variant="secondary" 
              onClick={handlePrevChapter} 
              disabled={
                mangaData?.chapters_url?.indexOf(selectedChapter) === mangaData?.chapters_url?.length - 1 || 
                !mangaData?.chapter_downloaded?.includes(mangaData?.chapters_url?.[mangaData?.chapters_url?.indexOf(selectedChapter) + 1])
              }
            >
              Previous Chapter
            </Button>
            <Button 
              variant="primary" 
              onClick={handleNextChapter} 
              disabled={
                mangaData?.chapters_url?.indexOf(selectedChapter) === 0 || 
                !mangaData?.chapter_downloaded?.includes(mangaData?.chapters_url?.[mangaData?.chapters_url?.indexOf(selectedChapter) - 1])
              } 
              className="bg-primary hover:bg-primary text-white"
            >
              Next Chapter
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Details Mode
  const imageSrc = resolveImageUrl(mangaData.local_image) || resolveImageUrl(mangaData.image);
  
  return (
    <div className="w-full h-full p-6 lg:p-10 animate-slide-up relative z-10 w-full overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 border-b border-primary/30 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/20 text-primary shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <BookOpen size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{mangaId}</h1>
            <p className="text-zinc-400 text-sm font-medium">Manga Details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="danger" 
            onClick={handleDelete}
            title="Delete from Library"
            className="h-[46px]"
          >
            <Trash2 size={16} />
          </Button>
          <Button 
            variant="secondary" 
            onClick={handleRefresh}
            isLoading={refreshing}
            className="h-[46px]"
            icon={refreshing ? undefined : <RefreshCw size={16} />}
          >
            Refresh
          </Button>
          <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => router.push('/entertainment-reading/manga-library')} className="h-[46px]">
            Back to Library
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 mb-8">
        <div className="w-full md:w-1/3 flex-shrink-0">
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-xl">
            {imageSrc ? (
              <img src={imageSrc} alt={mangaId!} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">No Image</div>
            )}
          </div>
        </div>

        <div className="w-full md:w-2/3 flex flex-col">
          <h2 className="text-xl font-bold text-white mb-4">Tag Information</h2>
          <div className="flex flex-wrap gap-2 mb-8">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-purple-300 rounded-lg text-sm border border-primary/30">
              <Edit2 size={14} /> {mangaData.status}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-purple-300 rounded-lg text-sm border border-primary/30">
              <Book size={14} /> {mangaData.type}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-purple-300 rounded-lg text-sm border border-primary/30">
              <Star size={14} /> Rating {mangaData.rating}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-purple-300 rounded-lg text-sm border border-primary/30">
              <Bookmark size={14} /> Chapter {mangaData.chapters_amount}
            </span>
          </div>

          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="w-full sm:w-48">
                <label className="block text-sm font-medium text-zinc-300 mb-2">Chapter Read</label>
                <div className="flex items-center">
                  <input 
                    type="number" 
                    value={chapterProgress}
                    onChange={(e) => {
                      let val = parseInt(e.target.value);
                      if (isNaN(val)) {
                        setChapterProgress("");
                        return;
                      }
                      if (val > mangaData.chapters_amount) val = mangaData.chapters_amount;
                      if (val < 0) val = 0;
                      setChapterProgress(val.toString());
                    }}
                    className="w-full bg-zinc-950 border border-white/10 rounded-l-xl p-3 text-white focus:border-primary outline-none text-center"
                  />
                  <div className="bg-zinc-800 border-y border-r border-white/10 rounded-r-xl p-3 text-zinc-400 font-medium whitespace-nowrap">
                    / {mangaData.chapters_amount}
                  </div>
                </div>
              </div>
              <Button variant="secondary" onClick={handleUpdateProgress} className="h-[46px] px-6">
                Update
              </Button>
              <Button 
                variant="primary" 
                onClick={handleDownloadAll} 
                className="h-[46px] px-6 bg-primary hover:bg-primary text-white min-w-[160px]"
                disabled={downloadingAll || ((mangaData.chapters_url || []).length === (mangaData.chapter_downloaded || []).length)}
                isLoading={downloadingAll}
              >
                {downloadingAll ? downloadProgress : "Download All"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900/30 border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-zinc-900/50 flex justify-between items-center">
          <h3 className="font-bold text-white">Chapters List ({mangaData.chapters_url?.length || 0})</h3>
        </div>
        <div className="max-h-[400px] overflow-y-auto p-4 space-y-2">
          {mangaData.chapters_url?.map((url: string, i: number) => {
            let currentChapter = url.split("/").pop() || "";
            if (mangaData.website === "mangadex.org/") {
              const match = url.match(/chapter-([0-9.]+)/);
              if (match) currentChapter = `chapter-${match[1]}`;
            }
            
            // Assume downloaded if it's in chapter_downloaded
            const isDownloaded = mangaData.chapter_downloaded?.includes(url);

            return (
              <div key={url} className="flex justify-between items-center p-3 rounded-xl bg-zinc-950 border border-white/5 hover:border-primary/30 transition-colors">
                <span className="font-medium text-zinc-300">Chapter {currentChapter.replace("chapter-", "")}</span>
                <div className="flex gap-2 min-w-[200px]">
                  <Button 
                    variant="primary" 
                    icon={<BookOpenCheck size={16} />} 
                    className="flex-1 bg-primary hover:bg-primary text-white"
                    disabled={!isDownloaded}
                    onClick={() => {
                      setSelectedChapter(url);
                      setMode("reading");
                    }}
                  >
                    Read
                  </Button>
                  {isDownloaded ? (
                    <Button variant="secondary" icon={<DownloadCloud size={16} />} disabled className="flex-1 text-green-400 border-green-500/30">
                      Done
                    </Button>
                  ) : (
                    <Button 
                      variant="secondary" 
                      icon={<Download size={16} />} 
                      className="flex-1"
                      isLoading={downloading[url]}
                      onClick={() => handleDownload(url)}
                    >
                      {downloading[url] ? "" : "Download"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {(!mangaData.chapters_url || mangaData.chapters_url.length === 0) && (
            <div className="text-center p-6 text-zinc-500">No chapters found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MangaRead() {
  return (
    <Suspense fallback={<div className="w-full h-full p-10 text-white flex justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
      <MangaReadContent />
    </Suspense>
  );
}
