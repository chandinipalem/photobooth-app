"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function ArchivePage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p>Loading…</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>All photos ({sessions.length})</h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {sessions.map((s) => (
          <img
            key={s.id}
            src={s.imageUrl}
            alt={s.id}
            style={{ width: 150 }}
          />
        ))}
      </div>
    </div>
  );
}