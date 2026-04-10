"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { authorizedFetch } from "@/lib/client-api";
import { browserSupabase } from "@/lib/supabase/client";
import type { GradeResult } from "@/lib/types";

interface StudyCard {
  id: string;
  prompt: string;
  question_type: "conceptual" | "application";
  position: number;
}

interface StartSessionResponse {
  sessionId: string;
  firstCard: {
    id: string;
    prompt: string;
    questionType: "conceptual" | "application";
  } | null;
}

export default function StudyPage() {
  const params = useParams<{ deckId: string }>();
  const router = useRouter();
  const deckId = params.deckId;

  const [sessionId, setSessionId] = useState("");
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerText, setAnswerText] = useState("");
  const [feedback, setFeedback] = useState<GradeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const currentCard = useMemo(() => cards[currentIndex] ?? null, [cards, currentIndex]);

  useEffect(() => {
    async function boot() {
      const { data: authData } = await browserSupabase.auth.getUser();
      if (!authData.user) {
        router.replace("/auth");
        return;
      }

      const [sessionRes, cardsRes] = await Promise.all([
        authorizedFetch<StartSessionResponse>("/api/sessions/start", {
          method: "POST",
          body: { deckId },
        }),
        browserSupabase
          .from("cards")
          .select("id, prompt, question_type, position")
          .eq("deck_id", deckId)
          .eq("user_id", authData.user.id)
          .order("position", { ascending: true }),
      ]);

      setSessionId(sessionRes.sessionId);

      const loadedCards = (cardsRes.data ?? []) as StudyCard[];

      if (loadedCards.length === 0) {
        setMessage("No cards available in this deck.");
        return;
      }

      if (sessionRes.firstCard) {
        const index = loadedCards.findIndex((card) => card.id === sessionRes.firstCard?.id);
        if (index > -1) {
          const ordered = [
            loadedCards[index],
            ...loadedCards.filter((card) => card.id !== sessionRes.firstCard?.id),
          ];
          setCards(ordered);
          return;
        }
      }

      setCards(loadedCards);
    }

    void boot();
  }, [deckId, router]);

  async function submitCurrentAnswer() {
    if (!currentCard || !sessionId) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const result = await authorizedFetch<GradeResult>(
        `/api/sessions/${sessionId}/answer`,
        {
          method: "POST",
          body: {
            cardId: currentCard.id,
            answerText,
          },
        },
      );

      setFeedback(result);
    } catch (error) {
      const err = error as Error;
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  function nextCard() {
    setFeedback(null);
    setAnswerText("");

    if (currentIndex + 1 >= cards.length) {
      setMessage("Session complete. Return to dashboard to start another round.");
      return;
    }

    setCurrentIndex((index) => index + 1);
  }

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="topbar">
          <div>
            <h1>Study Session</h1>
            <p className="muted">
              Card {Math.min(currentIndex + 1, cards.length)} of {cards.length}
            </p>
          </div>
          <Link href="/dashboard" className="btn btn-secondary">
            Back
          </Link>
        </div>

        {!currentCard ? (
          <p className="muted">Loading card...</p>
        ) : (
          <article className="card stack">
            <p className="eyebrow">{currentCard.question_type}</p>
            <h2>{currentCard.prompt}</h2>

            <label className="field">
              <span>Your answer</span>
              <textarea
                rows={8}
                value={answerText}
                onChange={(event) => setAnswerText(event.target.value)}
                placeholder="Answer in your own words..."
              />
            </label>

            <div className="actions">
              <button className="btn btn-primary" onClick={submitCurrentAnswer} disabled={busy || answerText.trim().length < 2}>
                Submit answer
              </button>
              {feedback && (
                <button className="btn btn-secondary" onClick={nextCard}>
                  Next card
                </button>
              )}
            </div>
          </article>
        )}

        {feedback && (
          <section className="card stack">
            <h3>Feedback</h3>
            <p><strong>Score:</strong> {feedback.scorePercent}% (quality {feedback.quality}/5)</p>
            <p><strong>Explanation:</strong> {feedback.explanationShort}</p>
            <p><strong>Missing concepts:</strong> {feedback.missingConcepts.length ? feedback.missingConcepts.join(", ") : "None"}</p>
            <p><strong>Misconceptions:</strong> {feedback.misconceptions.length ? feedback.misconceptions.join(", ") : "None"}</p>
            <p><strong>Model answer:</strong> {feedback.modelAnswer}</p>
            <p><strong>Next review:</strong> {new Date(feedback.nextReviewAt).toLocaleString()}</p>
          </section>
        )}

        {message && <p className="message">{message}</p>}
      </section>
    </main>
  );
}
