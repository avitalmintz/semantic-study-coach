"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { authorizedFetch } from "@/lib/client-api";
import { browserSupabase } from "@/lib/supabase/client";

interface EditableCard {
  prompt: string;
  idealAnswer: string;
  keyConcepts: string[];
  questionType: "conceptual" | "application";
}

export default function DeckEditPage() {
  const params = useParams<{ deckId: string }>();
  const router = useRouter();
  const deckId = params.deckId;

  const [title, setTitle] = useState("");
  const [cards, setCards] = useState<EditableCard[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadDeck = useCallback(async () => {
    const { data: authData } = await browserSupabase.auth.getUser();
    if (!authData.user) {
      router.replace("/auth");
      return;
    }

    const [deckRes, cardsRes] = await Promise.all([
      browserSupabase
        .from("decks")
        .select("title")
        .eq("id", deckId)
        .eq("user_id", authData.user.id)
        .single(),
      browserSupabase
        .from("cards")
        .select("prompt, ideal_answer, key_concepts, question_type, position")
        .eq("deck_id", deckId)
        .eq("user_id", authData.user.id)
        .order("position", { ascending: true }),
    ]);

    if (deckRes.data) {
      setTitle(deckRes.data.title);
    }

    if (cardsRes.data) {
      setCards(
        cardsRes.data.map((card) => ({
          prompt: card.prompt,
          idealAnswer: card.ideal_answer,
          keyConcepts: card.key_concepts,
          questionType: card.question_type,
        })),
      );
    }
  }, [deckId, router]);

  useEffect(() => {
    void loadDeck();
  }, [loadDeck]);

  function updateCard(index: number, patch: Partial<EditableCard>) {
    setCards((prev) =>
      prev.map((card, idx) => (idx === index ? { ...card, ...patch } : card)),
    );
  }

  function addCard() {
    setCards((prev) => [
      ...prev,
      {
        prompt: "",
        idealAnswer: "",
        keyConcepts: [""],
        questionType: "conceptual",
      },
    ]);
  }

  function removeCard(index: number) {
    setCards((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function onSaveAndPublish() {
    setMessage("");
    setBusy(true);

    try {
      await authorizedFetch<{ cards: EditableCard[] }>(`/api/decks/${deckId}/cards`, {
        method: "PATCH",
        body: {
          cards: cards.map((card) => ({
            ...card,
            keyConcepts: card.keyConcepts
              .map((concept) => concept.trim())
              .filter(Boolean),
          })),
        },
      });

      setMessage("Deck saved and published.");
      router.push("/dashboard");
    } catch (error) {
      const err = error as Error;
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="topbar">
          <div>
            <h1>Edit Deck</h1>
            <p className="muted">{title || "Untitled deck"}</p>
          </div>
          <Link href="/dashboard" className="btn btn-secondary">
            Back
          </Link>
        </div>

        <div className="stack">
          {cards.map((card, index) => (
            <article key={index} className="card stack">
              <div className="topbar">
                <h3>Card {index + 1}</h3>
                <button className="btn btn-secondary" onClick={() => removeCard(index)}>
                  Remove
                </button>
              </div>

              <label className="field">
                <span>Prompt</span>
                <textarea
                  rows={3}
                  value={card.prompt}
                  onChange={(event) => updateCard(index, { prompt: event.target.value })}
                />
              </label>

              <label className="field">
                <span>Ideal answer</span>
                <textarea
                  rows={4}
                  value={card.idealAnswer}
                  onChange={(event) => updateCard(index, { idealAnswer: event.target.value })}
                />
              </label>

              <label className="field">
                <span>Key concepts (comma-separated)</span>
                <input
                  value={card.keyConcepts.join(", ")}
                  onChange={(event) =>
                    updateCard(index, {
                      keyConcepts: event.target.value.split(",").map((item) => item.trim()),
                    })
                  }
                />
              </label>

              <label className="field">
                <span>Question type</span>
                <select
                  value={card.questionType}
                  onChange={(event) =>
                    updateCard(index, {
                      questionType: event.target.value as "conceptual" | "application",
                    })
                  }
                >
                  <option value="conceptual">Conceptual</option>
                  <option value="application">Application</option>
                </select>
              </label>
            </article>
          ))}
        </div>

        <div className="actions">
          <button className="btn btn-secondary" onClick={addCard}>Add card</button>
          <button className="btn btn-primary" onClick={onSaveAndPublish} disabled={busy || cards.length === 0}>
            Save and publish
          </button>
        </div>

        {message && <p className="message">{message}</p>}
      </section>
    </main>
  );
}
