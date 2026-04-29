import { drawBadgeIconSet } from "./badge-icon.js";
import { buildBadgeState } from "./badge-view.js";

export { buildBadgeState, formatBadgePercent } from "./badge-view.js";

export async function applyBadgeState(snapshot) {
  const state = buildBadgeState(snapshot);
  await chrome.action.setBadgeText({ text: state.text });
  await chrome.action.setBadgeBackgroundColor({ color: state.color });
  await chrome.action.setTitle({ title: state.title });

  const imageData = drawBadgeIconSet(state);
  if (imageData && chrome.action.setIcon) {
    await chrome.action.setIcon({ imageData });
  }
}
