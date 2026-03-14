import { describe, it, expect } from "vitest";
import { getModelPricing, calculateCost } from "../src/pricing.js";

describe("getModelPricing", () => {
  it("matches claude-sonnet-4 with date suffix", () => {
    const pricing = getModelPricing("claude-sonnet-4-20250514");
    expect(pricing.input).toBe(3);
    expect(pricing.output).toBe(15);
  });

  it("matches claude-opus-4 with date suffix", () => {
    const pricing = getModelPricing("claude-opus-4-20250514");
    expect(pricing.input).toBe(15);
    expect(pricing.output).toBe(75);
  });

  it("matches gpt-4o with date suffix", () => {
    const pricing = getModelPricing("gpt-4o-2024-08-06");
    expect(pricing.input).toBe(2.5);
    expect(pricing.output).toBe(10);
  });

  it("matches model without date suffix", () => {
    const pricing = getModelPricing("claude-sonnet-4");
    expect(pricing.input).toBe(3);
  });

  it("returns default pricing for unknown models", () => {
    const pricing = getModelPricing("totally-unknown-model");
    expect(pricing.input).toBe(3);
    expect(pricing.output).toBe(15);
  });

  it("matches claude-3-5-sonnet variants", () => {
    const pricing = getModelPricing("claude-3-5-sonnet-20241022");
    expect(pricing.input).toBe(3);
  });

  it("matches gemini models", () => {
    const pricing = getModelPricing("gemini-2.5-pro");
    expect(pricing.input).toBe(1.25);
  });
});

describe("calculateCost", () => {
  it("calculates cost for claude-sonnet-4 correctly", () => {
    const cost = calculateCost("claude-sonnet-4-20250514", {
      input: 1_000_000,
      output: 1_000_000,
      cacheCreation: 0,
      cacheRead: 0,
    });
    // $3/1M input + $15/1M output = $18
    expect(cost).toBeCloseTo(18, 4);
  });

  it("includes cache token costs", () => {
    const cost = calculateCost("claude-sonnet-4-20250514", {
      input: 0,
      output: 0,
      cacheCreation: 1_000_000,
      cacheRead: 1_000_000,
    });
    // $3.75/1M cache write + $0.30/1M cache read = $4.05
    expect(cost).toBeCloseTo(4.05, 4);
  });

  it("returns 0 for zero tokens", () => {
    const cost = calculateCost("claude-sonnet-4-20250514", {
      input: 0,
      output: 0,
      cacheCreation: 0,
      cacheRead: 0,
    });
    expect(cost).toBe(0);
  });

  it("handles small token counts accurately", () => {
    const cost = calculateCost("claude-sonnet-4-20250514", {
      input: 1000,
      output: 500,
      cacheCreation: 0,
      cacheRead: 0,
    });
    // (1000 * 3 + 500 * 15) / 1_000_000 = (3000 + 7500) / 1M = 0.0105
    expect(cost).toBeCloseTo(0.0105, 6);
  });
});
