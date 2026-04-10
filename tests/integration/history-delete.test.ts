import { describe, expect, it } from "vitest";

import { deleteHistoryForUser } from "@/lib/services/history";
import type { SupabaseClient } from "@supabase/supabase-js";

type TableRows = Record<string, Array<Record<string, unknown>>>;

class MockQuery {
  private table: string;
  private store: TableRows;
  private operation: "select" | "delete" | null = null;
  private filters: Array<{
    kind: "eq" | "in";
    column: string;
    value: unknown;
  }> = [];

  constructor(table: string, store: TableRows) {
    this.table = table;
    this.store = store;
  }

  select() {
    this.operation = "select";
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ kind: "eq", column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ kind: "in", column, value });
    return this;
  }

  private matches(row: Record<string, unknown>) {
    return this.filters.every((filter) => {
      if (filter.kind === "eq") {
        return row[filter.column] === filter.value;
      }

      return (filter.value as unknown[]).includes(row[filter.column]);
    });
  }

  private execute() {
    const rows = this.store[this.table] as Record<string, unknown>[];

    if (this.operation === "select") {
      return {
        data: rows.filter((row) => this.matches(row)),
        error: null,
      };
    }

    if (this.operation === "delete") {
      const remaining: Record<string, unknown>[] = [];
      for (const row of rows) {
        if (!this.matches(row)) {
          remaining.push(row);
        }
      }

      this.store[this.table] = remaining;
      return { data: null, error: null };
    }

    return { data: null, error: null };
  }

  then(resolve: (value: unknown) => unknown) {
    resolve(this.execute());
  }
}

class MockSupabase {
  store: TableRows;

  constructor(store: TableRows) {
    this.store = store;
  }

  from(table: string) {
    return new MockQuery(table, this.store);
  }
}

describe("delete history behavior", () => {
  it("deletes attempts and review state while preserving deck/cards", async () => {
    const store = {
      decks: [{ id: "deck-1", user_id: "user-1" }],
      cards: [
        { id: "card-1", deck_id: "deck-1", user_id: "user-1" },
        { id: "card-2", deck_id: "deck-2", user_id: "user-1" },
      ],
      attempts: [
        { id: "a1", user_id: "user-1", card_id: "card-1" },
        { id: "a2", user_id: "user-1", card_id: "card-2" },
      ],
      review_state: [
        { user_id: "user-1", card_id: "card-1" },
        { user_id: "user-1", card_id: "card-2" },
      ],
    };

    const supabase = new MockSupabase(store);

    await deleteHistoryForUser({
      supabase: supabase as unknown as SupabaseClient,
      userId: "user-1",
      deckId: "deck-1",
    });

    expect(store.decks).toHaveLength(1);
    expect(store.cards).toHaveLength(2);
    expect(store.attempts).toEqual([{ id: "a2", user_id: "user-1", card_id: "card-2" }]);
    expect(store.review_state).toEqual([{ user_id: "user-1", card_id: "card-2" }]);
  });
});
