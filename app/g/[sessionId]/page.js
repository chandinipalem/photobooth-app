"use client";

import { use, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export default function GalleryPage({ params }) {
  const { sessionId } = use(params);
  const [status, setStatus] = useState("loading");
  const [imageUrl, setImageUrl] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [fetchError, setFetchError] = useState(null);

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

  useEffect(() => {
    if (!imageUrl) return;
    fetch(imageUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const file = new File([blob], `photobooth-${sessionId}.png`, {
          type: blob.type || "image/png",
        });
        setPhotoFile(file);
      })
      .catch((err) => setFetchError(err.message));
  }, [imageUrl, sessionId]);

  async function handleSave() {
    if (!photoFile) return;
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
      if (err.name !== "AbortError") setFetchError(err.message);
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
        {fetchError && <p style={{ color: "red" }}>Error: {fetchError}</p>}
      </div>
    </div>
  );
}