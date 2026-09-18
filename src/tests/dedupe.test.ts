import { describe, it, expect } from "vitest";
import { DedupeFilter } from "../filters/dedupe";

describe("DedupeFilter", () => {
  it("remove duplicatas mantendo a primeira ocorrência (keep-first)", () => {
    const rows = [
      { id: 1, email: "a@teste.com" },
      { id: 2, email: "b@teste.com" },
      { id: 3, email: "a@teste.com" },
    ];
    const filter = new DedupeFilter("email", "keep-first");

    const result = filter.apply(rows);

    expect(result).toEqual([
      { id: 1, email: "a@teste.com" },
      { id: 2, email: "b@teste.com" },
    ]);
  });

  it("remove duplicatas mantendo a última ocorrência (keep-last)", () => {
    const rows = [
      { id: 1, email: "a@teste.com" },
      { id: 2, email: "b@teste.com" },
      { id: 3, email: "a@teste.com" },
    ];
    const filter = new DedupeFilter("email", "keep-last");

    const result = filter.apply(rows);

    expect(result).toEqual([
      { id: 2, email: "b@teste.com" },
      { id: 3, email: "a@teste.com" },
    ]);
  });

  it("não remove nada quando não há duplicatas", () => {
    const rows = [
      { id: 1, email: "a@teste.com" },
      { id: 2, email: "b@teste.com" },
    ];
    const filter = new DedupeFilter("email");

    const result = filter.apply(rows);

    expect(result).toHaveLength(2);
  });

  it("trata linhas com coluna de dedupe nula como únicas, sem agrupar entre si", () => {
    const rows = [
      { id: 1, email: null },
      { id: 2, email: null },
      { id: 3, email: "a@teste.com" },
    ];
    const filter = new DedupeFilter("email");

    const result = filter.apply(rows);

    expect(result).toHaveLength(3);
  });
});