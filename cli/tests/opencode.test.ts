import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { extractOpenCodeData } from "../src/opencode.js";

/**
 * Creates a temporary OpenCode-like message directory structure for testing.
 */
function createTempOpenCodeDir(): string {
  const dir = join(tmpdir(), `opencode-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(dir, "storage", "message"), { recursive: true });
  return dir;
}

function writeMessage(
  baseDir: string,
  sessionId: string,
  messageId: string,
  msg: Record<string, unknown>
): void {
  const sessionDir = join(baseDir, "storage", "message", sessionId);
  mkdirSync(sessionDir, { recursive: true });
  writeFileSync(
    join(sessionDir, `msg_${messageId}.json`),
    JSON.stringify(msg),
    "utf-8"
  );
}

/** Helper to create a valid OpenCode message. */
function makeMessage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "msg_test",
    sessionID: "sess_test",
    modelID: "claude-sonnet-4-20250514",
    time: { created: new Date("2026-03-10T12:00:00Z").getTime() },
    tokens: { input: 1000, output: 500, reasoning: 0, cache: { read: 200, write: 100 } },
    cost: 0,
    ...overrides,
  };
}

describe("extractOpenCodeData", () => {
  let tmpDir: string;
  const originalEnv = process.env.OPENCODE_DATA_DIR;

  beforeEach(() => {
    tmpDir = createTempOpenCodeDir();
    process.env.OPENCODE_DATA_DIR = tmpDir;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    if (originalEnv === undefined) {
      delete process.env.OPENCODE_DATA_DIR;
    } else {
      process.env.OPENCODE_DATA_DIR = originalEnv;
    }
  });

  it("returns empty array when no messages exist", async () => {
    const result = await extractOpenCodeData();
    expect(result).toEqual([]);
  });

  it("extracts a single message into a daily aggregate", async () => {
    writeMessage(tmpDir, "sess_1", "001", makeMessage());

    const result = await extractOpenCodeData();
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-03-10");
    expect(result[0].inputTokens).toBe(1000);
    expect(result[0].outputTokens).toBe(500);
    expect(result[0].cacheCreationTokens).toBe(100);
    expect(result[0].cacheReadTokens).toBe(200);
    expect(result[0].modelsUsed).toEqual(["claude-sonnet-4-20250514"]);
    expect(result[0].modelBreakdowns).toHaveLength(1);
    expect(result[0].modelBreakdowns[0].modelName).toBe("claude-sonnet-4-20250514");
  });

  it("aggregates multiple messages in the same session and day", async () => {
    writeMessage(tmpDir, "sess_1", "001", makeMessage({
      time: { created: new Date("2026-03-10T10:00:00Z").getTime() },
      tokens: { input: 1000, output: 500, cache: { read: 0, write: 0 } },
    }));
    writeMessage(tmpDir, "sess_1", "002", makeMessage({
      time: { created: new Date("2026-03-10T14:00:00Z").getTime() },
      tokens: { input: 2000, output: 1000, cache: { read: 300, write: 150 } },
    }));

    const result = await extractOpenCodeData();
    expect(result).toHaveLength(1);
    expect(result[0].inputTokens).toBe(3000);
    expect(result[0].outputTokens).toBe(1500);
  });

  it("aggregates messages across sessions for the same day", async () => {
    writeMessage(tmpDir, "sess_1", "001", makeMessage({
      time: { created: new Date("2026-03-10T10:00:00Z").getTime() },
      tokens: { input: 1000, output: 500, cache: { read: 0, write: 0 } },
    }));
    writeMessage(tmpDir, "sess_2", "001", makeMessage({
      time: { created: new Date("2026-03-10T15:00:00Z").getTime() },
      tokens: { input: 2000, output: 800, cache: { read: 0, write: 0 } },
    }));

    const result = await extractOpenCodeData();
    expect(result).toHaveLength(1);
    expect(result[0].inputTokens).toBe(3000);
    expect(result[0].outputTokens).toBe(1300);
  });

  it("separates messages from different days", async () => {
    writeMessage(tmpDir, "sess_1", "001", makeMessage({
      time: { created: new Date("2026-03-10T12:00:00Z").getTime() },
    }));
    writeMessage(tmpDir, "sess_1", "002", makeMessage({
      time: { created: new Date("2026-03-11T12:00:00Z").getTime() },
    }));

    const result = await extractOpenCodeData();
    expect(result).toHaveLength(2);
    const dates = result.map((d) => d.date).sort();
    expect(dates).toEqual(["2026-03-10", "2026-03-11"]);
  });

  it("tracks multiple models separately in breakdowns", async () => {
    writeMessage(tmpDir, "sess_1", "001", makeMessage({
      modelID: "claude-sonnet-4-20250514",
      tokens: { input: 1000, output: 500, cache: { read: 0, write: 0 } },
    }));
    writeMessage(tmpDir, "sess_1", "002", makeMessage({
      modelID: "claude-haiku-3-20250514",
      tokens: { input: 3000, output: 2000, cache: { read: 0, write: 0 } },
    }));

    const result = await extractOpenCodeData();
    expect(result).toHaveLength(1);
    expect(result[0].modelsUsed).toHaveLength(2);
    expect(result[0].modelBreakdowns).toHaveLength(2);

    const sonnet = result[0].modelBreakdowns.find(
      (m) => m.modelName === "claude-sonnet-4-20250514"
    );
    expect(sonnet?.inputTokens).toBe(1000);

    const haiku = result[0].modelBreakdowns.find(
      (m) => m.modelName === "claude-haiku-3-20250514"
    );
    expect(haiku?.inputTokens).toBe(3000);
  });

  it("calculates cost from tokens when message cost is 0", async () => {
    writeMessage(tmpDir, "sess_1", "001", makeMessage({
      modelID: "claude-sonnet-4-20250514",
      tokens: { input: 1_000_000, output: 1_000_000, cache: { read: 0, write: 0 } },
      cost: 0,
    }));

    const result = await extractOpenCodeData();
    // claude-sonnet-4: $3/1M input + $15/1M output = $18
    expect(result[0].totalCost).toBeCloseTo(18, 1);
  });

  it("uses message cost when non-zero instead of calculating", async () => {
    writeMessage(tmpDir, "sess_1", "001", makeMessage({
      tokens: { input: 1000, output: 500, cache: { read: 0, write: 0 } },
      cost: 42.5,
    }));

    const result = await extractOpenCodeData();
    expect(result[0].totalCost).toBe(42.5);
  });

  it("filters messages by since date", async () => {
    writeMessage(tmpDir, "sess_1", "001", makeMessage({
      time: { created: new Date("2026-03-08T12:00:00Z").getTime() },
    }));
    writeMessage(tmpDir, "sess_1", "002", makeMessage({
      time: { created: new Date("2026-03-12T12:00:00Z").getTime() },
    }));

    const result = await extractOpenCodeData("2026-03-10");
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-03-12");
  });

  it("skips messages with no tokens", async () => {
    writeMessage(tmpDir, "sess_1", "001", makeMessage({
      tokens: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    }));

    const result = await extractOpenCodeData();
    expect(result).toEqual([]);
  });

  it("skips malformed JSON files", async () => {
    const sessionDir = join(tmpDir, "storage", "message", "sess_1");
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(join(sessionDir, "msg_bad.json"), "not json", "utf-8");

    writeMessage(tmpDir, "sess_1", "002", makeMessage());

    const result = await extractOpenCodeData();
    expect(result).toHaveLength(1); // Only the valid message
  });

  describe("privacy enforcement", () => {
    it("output contains no session IDs or project paths", async () => {
      writeMessage(tmpDir, "sess_secret123", "001", makeMessage({
        sessionID: "sess_secret123",
        projectPath: "/Users/jim/secret-project",
        content: "This is a secret prompt",
      }));

      const result = await extractOpenCodeData();
      const json = JSON.stringify(result);

      expect(json).not.toContain("sess_secret123");
      expect(json).not.toContain("/Users/jim");
      expect(json).not.toContain("secret-project");
      expect(json).not.toContain("secret prompt");
    });

    it("SyncDay fields match the allowlisted schema exactly", async () => {
      writeMessage(tmpDir, "sess_1", "001", makeMessage());

      const result = await extractOpenCodeData();
      const day = result[0];

      const allowedKeys = [
        "date",
        "source",
        "inputTokens",
        "outputTokens",
        "cacheCreationTokens",
        "cacheReadTokens",
        "totalCost",
        "modelsUsed",
        "modelBreakdowns",
      ];
      expect(Object.keys(day).sort()).toEqual(allowedKeys.sort());

      const mbKeys = [
        "modelName",
        "inputTokens",
        "outputTokens",
        "cacheCreationTokens",
        "cacheReadTokens",
        "cost",
      ];
      expect(Object.keys(day.modelBreakdowns[0]).sort()).toEqual(mbKeys.sort());
    });
  });
});
