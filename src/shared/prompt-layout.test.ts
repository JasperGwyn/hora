import { describe, expect, it } from "vitest";
import {
  PROMPT_HEIGHT,
  PROMPT_WIDTH,
  promptBoundsForWorkArea,
} from "./prompt-layout.js";

describe("promptBoundsForWorkArea", () => {
  it("centra el cartel en el monitor del cursor", () => {
    const bounds = promptBoundsForWorkArea({
      x: 1920,
      y: 0,
      width: 1920,
      height: 1080,
    });
    expect(bounds).toEqual({
      width: PROMPT_WIDTH,
      height: PROMPT_HEIGHT,
      x: 1920 + Math.round((1920 - PROMPT_WIDTH) / 2),
      y: Math.round((1080 - PROMPT_HEIGHT) / 2),
    });
  });

  it("no se sale de un monitor más chico que el cartel", () => {
    const bounds = promptBoundsForWorkArea({
      x: 0,
      y: 0,
      width: 400,
      height: 500,
    });
    expect(bounds).toEqual({
      width: 400,
      height: 500,
      x: 0,
      y: 0,
    });
  });
});
