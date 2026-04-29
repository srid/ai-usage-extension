export function drawBadgeIconSet(state) {
  if (typeof OffscreenCanvas === "undefined") {
    return null;
  }

  const imageData = {};
  for (const size of [16, 32]) {
    imageData[size] = drawIcon(size, state);
  }
  return imageData;
}

function drawIcon(size, state) {
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d");
  const center = size / 2;
  const radius = size * 0.36;
  const lineWidth = Math.max(2, Math.round(size * 0.14));

  context.clearRect(0, 0, size, size);
  context.fillStyle = "#f8fafc";
  context.beginPath();
  context.arc(center, center, size * 0.42, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#c7ccd1";
  context.lineWidth = lineWidth;
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.stroke();

  const percent = state.status === "ok" && state.percent !== null ? Math.min(100, Math.max(0, state.percent)) : 0;
  if (percent > 0) {
    context.strokeStyle = state.color;
    context.lineCap = "round";
    context.beginPath();
    context.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (percent / 100));
    context.stroke();
  }

  context.fillStyle = state.status === "ok" ? "#202124" : state.color;
  context.font = `700 ${Math.round(size * 0.38)}px system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(state.status === "ok" ? String(Math.round(percent)) : "!", center, center + 1);

  return context.getImageData(0, 0, size, size);
}
