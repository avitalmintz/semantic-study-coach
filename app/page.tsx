import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="panel hero">
        <p className="eyebrow">AI Semantic Study Coach</p>
        <h1>Study by understanding, not memorizing exact words.</h1>
        <p>
          Upload notes or paste text, generate conceptual and application prompts,
          answer in your own words, and get semantic feedback with spaced
          repetition scheduling.
        </p>
        <div className="actions">
          <Link href="/auth" className="btn btn-primary">
            Start
          </Link>
          <Link href="/dashboard" className="btn btn-secondary">
            Dashboard
          </Link>
        </div>
      </section>

      <section className="panel comparison">
        <p className="eyebrow">How This Is Different From Quizlet</p>
        <div className="comparison-grid">
          <div className="comparison-copy stack">
            <h2>
              This coach grades semantic meaning, not wording similarity.
            </h2>
            <p>
              The screenshots show Quizlet relaxed mode accepting
              &quot;close enough&quot; responses. That can reward answers that look
              similar to expected wording even when concept coverage is thin.
            </p>
            <p>
              Here, wording style does not matter: paraphrase, sentence order,
              and writing style can all differ. What must match is the semantic
              idea and context of the target definition.
            </p>
            <ul className="comparison-points">
              <li>Semantic score (0-100), not just pass/fail.</li>
              <li>Missing concepts identified explicitly.</li>
              <li>Context mismatches flagged as misconceptions.</li>
              <li>Spaced repetition timing updates from answer quality.</li>
            </ul>
          </div>

          <div className="shot-grid">
            <figure className="shot-card">
              <Image
                src="/images/quizlet-relaxed-answer.png"
                alt="Quizlet relaxed mode marking a close answer as correct"
                width={1560}
                height={768}
              />
              <figcaption>
                In relaxed mode, Quizlet can mark &quot;close enough&quot; wording as
                correct.
              </figcaption>
            </figure>
            <figure className="shot-card">
              <Image
                src="/images/quizlet-grading-options.png"
                alt="Quizlet grading options showing Relaxed, Moderate, and Strict"
                width={1248}
                height={721}
              />
              <figcaption>
                Quizlet grading options: Relaxed, Moderate, and Strict.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>
    </main>
  );
}
