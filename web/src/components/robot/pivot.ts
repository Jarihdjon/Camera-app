/**
 * Rotation/scale pivot in the robot's own drawing coordinates (viewBox 0 0 200 220).
 * Motion would otherwise measure the origin from each part's own bounding box,
 * which makes arms and bolts swing around the wrong point.
 */
export const pivot = (x: number, y: number) => ({ transformBox: "view-box" as const, transformOrigin: `${x}px ${y}px` });
