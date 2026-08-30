"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../lib/firebase";

const SHOT_COUNT = 4;
const COUNTDOWN_SECONDS = 6;

function makeSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function KioskPage() {
  const videoRef = useRef(null);

  // idle | countdown | review | uploading | done
  const [stage, setStage] = useState("idle");
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [frames, setFrames] = useState([]);
  const [stripUrl, setStripUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [galleryUrl, setGalleryUrl] = useState(null);

  useEffect(() => {
    async function startCamera() {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1280, height: 960 },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    }
    startCamera();
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");

    setFrames((prev) => {
      const next = [...prev, dataUrl];
      if (next.length >= SHOT_COUNT) {
        setStage("review");
      } else {
        setCount(COUNTDOWN_SECONDS);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (stage !== "countdown") return;
    if (count === 0) {
      captureFrame();
      return;
    }
    const timer = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [stage, count, captureFrame]);

  function startSequence() {
    setFrames([]);
    setStripUrl(null);
    setGalleryUrl(null);
    setCount(COUNTDOWN_SECONDS);
    setStage("countdown");
  }

  // Composite once we hit the review stage
  useEffect(() => {
    if (stage !== "review" || frames.length < SHOT_COUNT) return;
    compositeStrip(frames).then(setStripUrl);
  }, [stage, frames]);

  async function compositeStrip(frameUrls) {
    const loaded = await Promise.all(
      frameUrls.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = src;
          })
      )
    );

    const frameW = 640;
    const frameH = Math.round((loaded[0].height / loaded[0].width) * frameW);
    const border = 24;
    const gap = 16;
    const footer = 90;
    const stripW = frameW + border * 2;
    const stripH = border + (frameH + gap) * SHOT_COUNT + footer;

    const canvas = document.createElement("canvas");
    canvas.width = stripW;
    canvas.height = stripH;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#fffcf5";
    ctx.fillRect(0, 0, stripW, stripH);

    loaded.forEach((img, i) => {
      const y = border + i * (frameH + gap);
      ctx.drawImage(img, border, y, frameW, frameH);
      ctx.strokeStyle = "#17140f";
      ctx.lineWidth = 2;
      ctx.strokeRect(border, y, frameW, frameH);
    });

    ctx.fillStyle = "#17140f";
    ctx.font = "600 28px sans-serif";
    ctx.textAlign = "center";
    const dateLabel = new Date().toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    ctx.fillText(dateLabel, stripW / 2, stripH - footer / 2 + 10);

    return canvas.toDataURL("image/png");
  }

  function retake() {
    setFrames([]);
    setStripUrl(null);
    setCount(COUNTDOWN_SECONDS);
    setStage("countdown");
  }

  async function handleUpload() {
    if (!stripUrl) return;
    setUploading(true);

    const sessionId = makeSessionId();
    const blob = await (await fetch(stripUrl)).blob();
    const storageRef = ref(storage, `photos/${sessionId}.png`);
    await uploadBytes(storageRef, blob, { contentType: "image/png" });
    const imageUrl = await getDownloadURL(storageRef);

    await setDoc(doc(db, "sessions", sessionId), {
      imageUrl,
      createdAt: serverTimestamp(),
    });

    setGalleryUrl(`${window.location.origin}/g/${sessionId}`);
    setUploading(false);
    setStage("done");
  }

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: "100vw",
          height: "100vh",
          objectFit: "cover",
          transform: "scaleX(-1)",
          display: stage === "review" || stage === "done" ? "none" : "block",
        }}
      />

      {stage === "idle" && (
        <button
          onClick={startSequence}
          style={{ position: "absolute", top: 20, left: 20, padding: "12px 24px" }}
        >
          Start
        </button>
      )}

      {stage === "countdown" && (
        <div style={{ position: "absolute", top: 20, left: 20, fontSize: 48, color: "white" }}>
          {count > 0 ? count : "📸"} ({frames.length + 1} of {SHOT_COUNT})
        </div>
      )}

      {stage === "review" && (
        <div style={{ padding: 20, textAlign: "center" }}>
          <h2>How's this look?</h2>
          {stripUrl ? (
            <img src={stripUrl} alt="Photo strip preview" style={{ width: 200 }} />
          ) : (
            <p>Putting your strip together…</p>
          )}
          <div style={{ marginTop: 16, display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={retake}>Retake all</button>
            <button onClick={handleUpload} disabled={!stripUrl || uploading}>
              {uploading ? "Saving…" : "Looks good"}
            </button>
          </div>
        </div>
      )}

      {stage === "done" && galleryUrl && (
        <div style={{ padding: 20, textAlign: "center" }}>
          <h2>All set</h2>
          <p>Scan to view your photos</p>
          <div style={{ background: "white", padding: 16, display: "inline-block" }}>
            <QRCodeCanvas value={galleryUrl} size={180} />
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={startSequence}>Next guest</button>
          </div>
        </div>
      )}
    </div>
  );
}