"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { authorizedFetch } from "@/lib/client-api";
import { browserSupabase } from "@/lib/supabase/client";

interface MaterialItem {
  id: string;
  source_type: "text" | "pdf";
  token_estimate: number;
  created_at: string;
}

interface DeckItem {
  id: string;
  title: string;
  status: "draft" | "published";
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [decks, setDecks] = useState<DeckItem[]>([]);

  const [sourceType, setSourceType] = useState<"text" | "pdf">("text");
  const [studyText, setStudyText] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [title, setTitle] = useState("");
  const [cardCountTarget, setCardCountTarget] = useState(12);

  const sortedMaterials = useMemo(
    () => materials.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [materials],
  );

  const loadData = useCallback(async () => {
    const { data: authData } = await browserSupabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      router.replace("/auth");
      return;
    }

    setUserId(user.id);

    const [materialsRes, decksRes] = await Promise.all([
      browserSupabase
        .from("materials")
        .select("id, source_type, token_estimate, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25),
      browserSupabase
        .from("decks")
        .select("id, title, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    if (materialsRes.data) {
      setMaterials(materialsRes.data as MaterialItem[]);
      if (!selectedMaterialId && materialsRes.data.length > 0) {
        setSelectedMaterialId(materialsRes.data[0].id);
      }
    }

    if (decksRes.data) {
      setDecks(decksRes.data as DeckItem[]);
    }
  }, [router, selectedMaterialId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function onUploadMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    try {
      let body: { sourceType: "text" | "pdf"; text?: string; fileId?: string };

      if (sourceType === "text") {
        body = {
          sourceType: "text",
          text: studyText,
        };
      } else {
        if (!pdfFile || !userId) {
          throw new Error("Choose a PDF file first.");
        }

        const sanitizedName = pdfFile.name.replace(/\s+/g, "-").toLowerCase();
        const filePath = `${userId}/${Date.now()}-${sanitizedName}`;

        const { error: uploadError } = await browserSupabase.storage
          .from(process.env.NEXT_PUBLIC_SUPABASE_MATERIALS_BUCKET ?? "materials")
          .upload(filePath, pdfFile, {
            contentType: "application/pdf",
          });

        if (uploadError) {
          throw uploadError;
        }

        body = {
          sourceType: "pdf",
          fileId: filePath,
        };
      }

      const result = await authorizedFetch<{ materialId: string; tokenEstimate: number }>(
        "/api/materials/ingest",
        {
          method: "POST",
          body,
        },
      );

      setMessage(`Material saved. Estimated tokens: ${result.tokenEstimate}.`);
      setStudyText("");
      setPdfFile(null);
      await loadData();
      setSelectedMaterialId(result.materialId);
    } catch (error) {
      const err = error as Error;
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onGenerateDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    try {
      const result = await authorizedFetch<{ deckId: string }>(
        "/api/decks/generate",
        {
          method: "POST",
          body: {
            materialId: selectedMaterialId,
            title,
            cardCountTarget,
          },
        },
      );

      router.push(`/decks/${result.deckId}/edit`);
    } catch (error) {
      const err = error as Error;
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteHistory(deckId?: string) {
    setMessage("");
    setBusy(true);

    try {
      await authorizedFetch<{ success: boolean }>("/api/history", {
        method: "DELETE",
        body: deckId ? { deckId } : {},
      });
      setMessage(deckId ? "Deleted history for this deck." : "Deleted all history.");
    } catch (error) {
      const err = error as Error;
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    await browserSupabase.auth.signOut();
    router.replace("/auth");
  }

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="topbar">
          <div>
            <h1>Dashboard</h1>
            <p className="muted">Create materials, generate decks, and launch study sessions.</p>
          </div>
          <button className="btn btn-secondary" onClick={onSignOut}>Sign out</button>
        </div>

        <div className="grid two">
          <form className="stack" onSubmit={onUploadMaterial}>
            <h2>1) Ingest Material</h2>
            <div className="field">
              <span>Source</span>
              <div className="source-toggle" role="group" aria-label="Ingest source">
                <button
                  type="button"
                  className={`btn ${sourceType === "text" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => {
                    setSourceType("text");
                    setPdfFile(null);
                  }}
                >
                  Paste Text
                </button>
                <button
                  type="button"
                  className={`btn ${sourceType === "pdf" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => {
                    setSourceType("pdf");
                    setStudyText("");
                  }}
                >
                  Upload PDF
                </button>
              </div>
            </div>

            {sourceType === "text" ? (
              <label className="field">
                <span>Study text</span>
                <textarea
                  value={studyText}
                  onChange={(event) => setStudyText(event.target.value)}
                  rows={10}
                  placeholder="Paste notes, lecture transcript, or reading excerpts..."
                  required
                />
              </label>
            ) : (
              <label className="field">
                <span>PDF file</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
                  required
                />
                <small className="muted">
                  Upload a PDF and we extract the text for deck generation.
                </small>
              </label>
            )}

            <button className="btn btn-primary" disabled={busy} type="submit">
              Save material
            </button>
          </form>

          <form className="stack" onSubmit={onGenerateDeck}>
            <h2>2) Generate Deck</h2>
            <label className="field">
              <span>Material</span>
              <select
                value={selectedMaterialId}
                onChange={(event) => setSelectedMaterialId(event.target.value)}
                required
              >
                <option value="" disabled>Select material</option>
                {sortedMaterials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.source_type.toUpperCase()} • {material.token_estimate} tokens • {new Date(material.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Deck title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Biology Unit 3"
                minLength={3}
                required
              />
            </label>

            <label className="field">
              <span>Card count target</span>
              <input
                value={cardCountTarget}
                onChange={(event) => setCardCountTarget(Number(event.target.value || 12))}
                type="number"
                min={3}
                max={60}
                required
              />
            </label>

            <button className="btn btn-primary" disabled={busy} type="submit">
              Generate and review cards
            </button>
          </form>
        </div>

        <hr className="sep" />

        <div className="topbar">
          <h2>Your decks</h2>
          <button className="btn btn-secondary" disabled={busy} onClick={() => void onDeleteHistory()}>
            Delete all history
          </button>
        </div>

        <div className="stack">
          {decks.length === 0 && <p className="muted">No decks yet.</p>}
          {decks.map((deck) => (
            <article key={deck.id} className="card">
              <div>
                <h3>{deck.title}</h3>
                <p className="muted">
                  {deck.status} • {new Date(deck.created_at).toLocaleString()}
                </p>
              </div>
              <div className="actions">
                <Link className="btn btn-secondary" href={`/decks/${deck.id}/edit`}>
                  Edit
                </Link>
                <Link className="btn btn-primary" href={`/study/${deck.id}`}>
                  Study
                </Link>
                <button className="btn btn-secondary" onClick={() => void onDeleteHistory(deck.id)}>
                  Delete history
                </button>
              </div>
            </article>
          ))}
        </div>

        {message && <p className="message">{message}</p>}
      </section>
    </main>
  );
}
