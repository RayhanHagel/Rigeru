import os
import shutil
import subprocess
import threading
import queue
import logging
from typing import Optional, Any

class VideoPipeWriter:
    """
    Asynchronous pipe writer multiplexing video frames into an FFmpeg stdin sub-process pipe.
    """

    def __init__(
        self,
        output_path: str,
        width: int,
        height: int,
        fps: float,
        input_path: Optional[str] = None,
        encoder: str = "libx264"
    ) -> None:
        """
        Initialize the FFmpeg video pipe writer worker.

        Args:
            output_path (str): Destination video file path.
            width (int): Frame pixel width.
            height (int): Frame pixel height.
            fps (float): Target video frame rate.
            input_path (Optional[str], optional): Source media path for audio track muxing. Defaults to None.
            encoder (str, optional): FFmpeg video encoder codec name. Defaults to "libx264".
        """
        self.output_path = output_path
        self.width = width
        self.height = height
        self.fps = fps
        self.input_path = input_path
        self.encoder = encoder

        self._has_ffmpeg = shutil.which("ffmpeg") is not None
        self._pipe = None
        self._cv2_writer = None
        self._q: queue.Queue = queue.Queue(maxsize=128)
        self._worker_thread: Optional[threading.Thread] = None
        self._closed = False

        if self._has_ffmpeg:
            self._start_ffmpeg_pipe()
        else:
            self._start_cv2_fallback()

        self._worker_thread = threading.Thread(target=self._worker, daemon=True)
        self._worker_thread.start()

    def _start_ffmpeg_pipe(self) -> None:
        """Spawn the FFmpeg background process reading raw BGR frames from stdin."""
        cmd = [
            "ffmpeg", "-y",
            "-f", "rawvideo",
            "-vcodec", "rawvideo",
            "-s", f"{self.width}x{self.height}",
            "-pix_fmt", "bgr24",
            "-r", str(self.fps),
            "-i", "-"
        ]

        if self.input_path and os.path.isfile(self.input_path):
            cmd.extend(["-i", self.input_path, "-c:a", "copy", "-map", "0:v:0", "-map", "1:a:0?"])
        else:
            cmd.extend(["-map", "0:v:0"])

        cmd.extend([
            "-c:v", self.encoder,
            "-pix_fmt", "yuv420p",
            "-shortest",
            self.output_path
        ])

        self._pipe = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE
        )

    def _start_cv2_fallback(self) -> None:
        """Initialize OpenCV VideoWriter fallback when FFmpeg is not available on PATH."""
        import cv2
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        self._cv2_writer = cv2.VideoWriter(
            self.output_path, fourcc, self.fps, (self.width, self.height)
        )

    def _worker(self) -> None:
        """
        Internal worker consuming frames from the internal queue and writing to the pipe.

        Returns:
            None
        """
        while True:
            item = self._q.get()
            if item is None:
                break
            try:
                if self._pipe and self._pipe.stdin:
                    self._pipe.stdin.write(item)
                elif self._cv2_writer:
                    self._cv2_writer.write(item)
            except Exception as e:
                logging.warning(f"VideoPipeWriter write error: {e}")
                break

    def write_frame(self, frame_bgr_or_bytes: Any) -> None:
        """
        Enqueue a frame (BGR numpy array or raw bytes) for encoding into the output stream.

        Args:
            frame_bgr_or_bytes (Any): BGR OpenCV numpy image or raw bytes buffer.

        Returns:
            None
        """
        if self._closed:
            return

        if hasattr(frame_bgr_or_bytes, "tobytes"):
            if self._pipe:
                data = frame_bgr_or_bytes.tobytes()
            else:
                data = frame_bgr_or_bytes
        else:
            data = frame_bgr_or_bytes

        self._q.put(data)

    def close(self) -> None:
        """
        Flush all queued frames, close the sub-process stdin pipe, and terminate encoding.

        Returns:
            None
        """
        if self._closed:
            return
        self._closed = True

        self._q.put(None)
        if self._worker_thread:
            self._worker_thread.join()

        if self._pipe:
            try:
                if self._pipe.stdin:
                    self._pipe.stdin.close()
                self._pipe.wait(timeout=30)
            except Exception:
                self._pipe.kill()
            self._pipe = None

        if self._cv2_writer:
            self._cv2_writer.release()
            self._cv2_writer = None
