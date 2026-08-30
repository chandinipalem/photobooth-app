"use client";

import { use, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export default function GalleryPage({ params }) {
  const { sessionId } = use(params);
  const [status, setStatus] = useState("loading"); // loading | found | missing
  const [imageUrl, setImageUrl] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "sessions", sessionId));
      if (snap.exists()) {
        setImageUrl(snap.data().imageUrl);
        setStatus("found");
      } else {
        setStatus("missing");
      }
    }
    load();
  }, [sessionId]);

  // Pre-fetch the image as soon as we know its URL, well before any tap --
  // this is what keeps the later share() call fast enough for iOS to allow it.
  useEffect(() => {
    if (!imageUrl) return;
    fetch(imageUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], `photobooth-${sessionId}.png`, {
          type: blob.type || "image/png",
        });
        setPhotoFile(file);
      })
      .catch((err) => console.error("Pre-fetch failed:", err));
  }, [imageUrl, sessionId]);

  async function handleSave() {
    if (!photoFile) {
      // Fetch never finished (e.g. slow connection) -- fall back to opening
      // the image directly so they can still long-press to save it.
      window.open(imageUrl, "_blank");
      return;
    }
    try {
      if (navigator.canShare && navigator.canShare({ files: [photoFile] })) {
        await navigator.share({ files: [photoFile], title: "Photobooth strip" });
      } else {
        const blobUrl = URL.createObjectURL(photoFile);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = photoFile.name;
        a.click();
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error(err);
        alert("Couldn't open the share sheet. Try pressing and holding the photo to save it instead.");
      }
    }
  }

  if (status === "loading") return <p>Loading your photos…</p>;
  if (status === "missing") return <p>Couldn't find this photo strip.</p>;

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <h1>Your photobooth strip</h1>
      <img src={imageUrl} alt="Your photobooth strip" style={{ maxWidth: "90vw" }} />
      <div>
        <button onClick={handleSave} disabled={!photoFile}>
          {photoFile ? "Save to Photos" : "Preparing…"}
        </button>
      </div>
    </div>
  );
}