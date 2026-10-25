"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [api, setApi] = useState("checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setApi(d.status))
      .catch(() => setApi("failed"));
  }, []);

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold">BrandGuard AI</h1>
      <p className="mt-4">Backend: {api}</p>
    </main>
  );
}