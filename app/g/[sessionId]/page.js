"use client";

import { use, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export default function GalleryPage({ params }) {
  const { sessionId } = use(params);
  const [status, setStatus] = useState("loading"); // loading | found | missing
  const [imageUrl, setImageUrl] = useState(null);

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

  if (status === "loading") return <p>Loading your photos…</p>;
  if (status === "missing") return <p>Couldn't find this photo strip.</p>;

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <h1>Your photobooth strip</h1>
      <img src={imageUrl} alt="Your photobooth strip" style={{ maxWidth: "90vw" }} />
      <p style={{ color: "#888", fontSize: 14 }}>Press and hold the photo to save it</p>
    </div>
  );
}