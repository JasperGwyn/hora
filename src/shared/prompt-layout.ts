export const PROMPT_WIDTH = 460;
export const PROMPT_HEIGHT = 700;

export type WorkArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function promptBoundsForWorkArea(
  workArea: WorkArea,
  width = PROMPT_WIDTH,
  height = PROMPT_HEIGHT,
): WindowBounds {
  const w = Math.min(width, workArea.width);
  const h = Math.min(height, workArea.height);
  return {
    width: w,
    height: h,
    x: Math.round(workArea.x + (workArea.width - w) / 2),
    y: Math.round(workArea.y + (workArea.height - h) / 2),
  };
}
