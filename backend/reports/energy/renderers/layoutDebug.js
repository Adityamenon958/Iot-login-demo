function isLayoutDebugEnabled() {
  return process.env.REPORT_LAYOUT_DEBUG === '1' || process.env.NODE_ENV === 'development' && process.env.REPORT_LAYOUT_DEBUG === 'true';
}

function addTrace(debugState, event) {
  if (!debugState.enabled) return;
  debugState.events.push(event);
}

function drawDebugOverlay(doc, frame, remainingHeight) {
  if (!frame?.debug?.enabled) return;
  doc.save();
  doc.rect(frame.x, frame.y, frame.width, frame.height).lineWidth(0.3).strokeColor('#dc3545').stroke();
  doc.fontSize(6).fillColor('#6c757d').text(
    `${frame.sectionId} · ${frame.variant} · p${frame.pageIndex + 1} · h:${Math.round(frame.height)} · rem:${Math.round(remainingHeight)}`,
    frame.x + 2,
    frame.y + 2,
    { width: frame.width - 4 }
  );
  doc.restore();
}

module.exports = {
  isLayoutDebugEnabled,
  addTrace,
  drawDebugOverlay,
};
