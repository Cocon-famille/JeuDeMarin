import { el } from "./dom";

/** Route en diagonale encadrée par deux traces de roues (§05). */
export function makeLogoBadge(size: number, accentOnDark = true): HTMLElement {
  const badge = el("div", {
    attrs: {
      style: `width:${size}px;height:${size}px;border-radius:${size * 0.29}px;background:${accentOnDark ? "var(--tt-gyrophare)" : "var(--tt-nuit)"};position:relative;overflow:hidden;flex:none;`,
    },
  });
  const stripeColor = accentOnDark ? "var(--tt-nuit)" : "var(--tt-marquage)";
  const dashColor = accentOnDark ? "var(--tt-gyrophare)" : "var(--tt-nuit)";
  badge.innerHTML = `
    <div style="position:absolute;left:20%;top:-14%;width:${size * 0.12}px;height:128%;background:${stripeColor};transform:rotate(24deg);"></div>
    <div style="position:absolute;left:50%;top:-14%;width:${size * 0.21}px;height:128%;margin-left:-${size * 0.105}px;background:${stripeColor};transform:rotate(24deg);"></div>
    <div style="position:absolute;left:50%;top:10%;width:${size * 0.21}px;height:20%;margin-left:-${size * 0.105}px;background:${dashColor};transform:rotate(24deg);"></div>
    <div style="position:absolute;left:50%;top:62%;width:${size * 0.21}px;height:20%;margin-left:-${size * 0.105}px;background:${dashColor};transform:rotate(24deg);"></div>
    <div style="position:absolute;right:20%;top:-14%;width:${size * 0.12}px;height:128%;background:${stripeColor};transform:rotate(24deg);"></div>
  `;
  return badge;
}
