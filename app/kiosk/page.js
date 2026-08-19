"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../lib/firebase";
import { QRCodeCanvas } from "qrcode.react";

function makeSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const SHOT_COUNT = 4;
const COUNTDOWN_SECONDS = 3;

export default function KioskPage() {
  const videoRef = useRef(null);

  // idle | countdown | done
  const [stage, setStage] = useState("idle");
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [frames, setFrames] = useState([]);
  const [stripUrl, setStripUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [galleryUrl, setGalleryUrl] = useState(null);

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
  }

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
        setStage("done");
      } else {
        setCount(COUNTDOWN_SECONDS);
      }
      return next;
    });
  }, []);

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

useEffect(() => {
  if (stage !== "done" || frames.length < SHOT_COUNT) return;
  compositeStrip(frames).then(setStripUrl);
}, [stage, frames]);

  // The countdown ticker
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
    setCount(COUNTDOWN_SECONDS);
    setStage("countdown");
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
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            fontSize: 48,
            color: "white",
          }}
        >
          {count > 0 ? count : "📸"} ({frames.length + 1} of {SHOT_COUNT})
        </div>
      )}

      {stage === "done" && (
        <div style={{ position: "absolute", bottom: 20, left: 20 }}>
          {stripUrl && <img src={stripUrl} alt="Photo strip" style={{ width: 200 }} />}

          {!galleryUrl && (
            <button onClick={handleUpload} disabled={uploading}>
              {uploading ? "Uploading..." : "Looks good"}
            </button>
          )}

          {galleryUrl && (
            <div style={{ background: "white", padding: 16, display: "inline-block" }}>
              <QRCodeCanvas value={galleryUrl} size={180} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}