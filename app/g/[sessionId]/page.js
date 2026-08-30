"use client";

import { use, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export default function GalleryPage({ params }) {
  const { sessionId } = use(params);
  const [status, setStatus] = useState("loading"); // loading | found | missing
  const [imageUrl, setImageUrl] = useState(null);
  const [saving, setSaving] = useState(false);

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

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], `photobooth-${sessionId}.png`, { type: blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Photobooth strip" });
      } else {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `photobooth-${sessionId}.png`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      // AbortError fires if the user cancels the share sheet -- not a real error
      if (err.name !== "AbortError") {
        console.error(err);
      }
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") return <p>Loading your photos…</p>;
  if (status === "missing") return <p>Couldn't find this photo strip.</p>;

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <h1>Your photobooth strip</h1>
      <img src={imageUrl} alt="Your photobooth strip" style={{ maxWidth: "90vw" }} />
      <div>
        <button onClick={handleSave} disabled={saving}>
          {saving ? "Preparing…" : "Save to Photos"}
        </button>
      </div>
    </div>
  );
}