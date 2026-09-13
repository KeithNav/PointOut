export const STYLES = `
:host { all: initial; }
.po-root {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.po-canvas { position: absolute; top: 0; left: 0; pointer-events: none; touch-action: none; }
.po-popover-layer { position: absolute; top: 0; left: 0; pointer-events: none; }
.po-popover-layer .po-popover { pointer-events: auto; }

.po-root[data-visible="false"] .po-toolbar,
.po-root[data-visible="false"] .po-canvas,
.po-root[data-visible="false"] .po-popover-layer {
  display: none;
}
.po-root[data-visible="false"] .po-bubble { opacity: .55; }

.po-bubble {
  position: fixed;
  right: 24px;
  bottom: 24px;
  min-width: 172px;
  height: 58px;
  padding: 6px 14px 6px 7px;
  border-radius: 18px;
  background: linear-gradient(135deg, #171c35 0%, #273b80 100%);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, .2);
  cursor: pointer;
  box-shadow: 0 12px 28px rgba(23, 34, 82, .3), 0 3px 8px rgba(10, 16, 40, .2);
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  font-family: inherit;
  transition: transform .2s ease, box-shadow .2s ease, opacity .2s ease;
}
.po-bubble::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(115deg, rgba(255, 255, 255, .16), transparent 45%);
  pointer-events: none;
}
.po-bubble:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 34px rgba(23, 34, 82, .38), 0 4px 10px rgba(10, 16, 40, .18);
}
.po-bubble:focus-visible {
  outline: 3px solid #93c5fd;
  outline-offset: 3px;
}
.po-bubble-mark {
  position: relative;
  z-index: 1;
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  place-items: center;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #d8fbff 0 12%, #73e5f5 38%, #4c8ee8 100%);
  overflow: hidden;
  background: #07101f;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, .7), 0 4px 10px rgba(4, 19, 56, .25);
}
.po-bubble-mark svg {
  width: 44px;
  max-width: 44px;
  height: 44px;
}
.po-bubble-copy {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}
.po-bubble-wordmark { display: block; width: 94px; height: 21px; object-fit: contain; object-position: left center; mix-blend-mode: screen; }
.po-bubble-status {
  color: #c7d2fe;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.1;
}
.po-bubble-indicator {
  position: relative;
  z-index: 1;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5eead4;
  box-shadow: 0 0 0 4px rgba(94, 234, 212, .16);
}
.po-root[data-visible="false"] .po-bubble {
  background: linear-gradient(135deg, #26304f 0%, #3a4b77 100%);
}
.po-root[data-visible="false"] .po-bubble-indicator {
  background: #cbd5e1;
  box-shadow: none;
}

.po-toolbar {
  position: fixed;
  right: 24px;
  bottom: 94px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  justify-content: center;
  max-width: calc(100vw - 32px);
  background: rgba(15, 23, 42, .94);
  backdrop-filter: blur(14px);
  padding: 7px;
  border: 1px solid rgba(255, 255, 255, .12);
  border-radius: 16px;
  box-shadow: 0 14px 32px rgba(15, 23, 42, .28);
  z-index: 2;
}

.po-tool-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: #e5e7eb;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.po-tool-btn svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.po-tool-btn[data-tool="pointer"] svg { fill: currentColor; stroke: currentColor; }
.po-tool-btn:hover { background: rgba(255, 255, 255, .08); }
.po-tool-btn:focus-visible, .po-hide-btn:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
.po-tool-btn[data-active="true"] { background: linear-gradient(135deg, #2563eb, #4f46e5); color: #fff; box-shadow: 0 3px 8px rgba(37, 99, 235, .35); }

.po-color { width: 28px; height: 28px; padding: 0; border: none; background: none; border-radius: 7px; cursor: pointer; }

.po-hide-btn {
  border: none;
  background: rgba(255, 255, 255, .08);
  color: #e5e7eb;
  border-radius: 9px;
  padding: 0 10px;
  height: 34px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}
.po-hide-btn:hover { background: rgba(255, 255, 255, .16); }

.po-shape[data-resolved="true"] { opacity: .35; }

.po-popover {
  position: absolute;
  width: min(280px, calc(100vw - 24px));
  max-height: calc(100dvh - 24px);
  box-sizing: border-box;
  overflow-y: auto;
  background: #fff;
  color: #111827;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, .25);
  padding: 10px;
  font-size: 13px;
  transform: translate(-10px, 10px);
}
.po-popover-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 6px;
}
.po-popover textarea {
  width: 100%;
  min-height: 56px;
  resize: vertical;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 6px 8px;
  font: inherit;
  box-sizing: border-box;
}
.po-popover textarea:disabled { background: #f9fafb; color: #6b7280; }
.po-comments {
  display: grid;
  gap: 6px;
  max-height: 132px;
  margin-top: 8px;
  overflow-y: auto;
}
.po-comment {
  display: grid;
  gap: 2px;
  padding: 7px 8px;
  border-radius: 8px;
  background: #f3f4f6;
  color: #374151;
  font-size: 12px;
  line-height: 1.35;
}
.po-comment strong { color: #111827; font-size: 11px; }
.po-reply {
  min-height: 48px !important;
  margin-top: 8px;
}
.po-popover-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
.po-resolve { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #374151; margin-right: auto; }
.po-popover button { border: none; border-radius: 7px; padding: 5px 10px; font-size: 12px; cursor: pointer; }
.po-save { background: #2563eb; color: #fff; }
.po-delete { background: #fee2e2; color: #b91c1c; }
.po-close { background: transparent; color: #6b7280; padding: 5px 7px; }

.po-issue-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  bottom: 20px;
  display: flex;
  width: min(360px, calc(100vw - 40px));
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, .28);
  border-radius: 20px;
  background: rgba(255, 255, 255, .96);
  box-shadow: 0 22px 60px rgba(15, 23, 42, .24);
  color: #0f172a;
  opacity: 0;
  pointer-events: none;
  transform: translateX(calc(100% + 32px));
  transition: transform .25s ease, opacity .2s ease;
  z-index: 3;
}
.po-issue-panel[data-open="true"] { opacity: 1; pointer-events: auto; transform: translateX(0); }
.po-issue-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 18px 16px;
  border-bottom: 1px solid #e2e8f0;
}
.po-issue-panel-logo {
  display: grid;
  width: 54px;
  height: 54px;
  margin-right: 10px;
  place-items: center;
  border-radius: 9px;
  background: #07101f;
}
.po-issue-panel-logo svg {
  width: 42px;
  height: 42px;
}
.po-issue-panel h2 { margin: 2px 0 0; font-size: 20px; line-height: 1.1; letter-spacing: -.02em; }
.po-issue-panel-actions { display: flex; align-items: center; gap: 8px; }
.po-issue-count {
  display: grid;
  min-width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 999px;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 12px;
  font-weight: 700;
}
.po-issue-panel-close {
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 16px;
}
.po-issue-panel-close:hover { background: #f1f5f9; color: #0f172a; }
.po-issue-list { display: grid; flex: 1; min-height: 0; align-content: start; gap: 9px; padding: 12px; overflow-y: auto; }
.po-issue-empty { margin: 20px 8px; color: #64748b; font-size: 13px; line-height: 1.5; text-align: center; }
.po-issue-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  padding: 4px;
  border: 1px solid #e2e8f0;
  border-radius: 13px;
  background: #fff;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.po-issue-item[data-selected="true"] { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(129, 140, 248, .16); }
.po-issue-select {
  display: grid;
  min-width: 0;
  gap: 5px;
  padding: 9px 8px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.po-issue-select:hover { background: #f8fafc; }
.po-issue-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; }
.po-issue-status { padding: 3px 6px; border-radius: 999px; background: #fee2e2; color: #b91c1c; }
.po-issue-status[data-resolved="true"] { background: #dcfce7; color: #15803d; }
.po-issue-select strong { font-size: 12px; }
.po-issue-message { overflow: hidden; color: #475569; font-size: 12px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.po-issue-footer { color: #94a3b8; font-size: 10px; }
.po-issue-resolve {
  align-self: center;
  margin-right: 5px;
  padding: 6px 7px;
  border: 0;
  border-radius: 7px;
  background: #eef2ff;
  color: #4338ca;
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
}
.po-issue-resolve:hover { background: #e0e7ff; }

@media (max-width: 480px) {
  .po-bubble {
    right: max(12px, env(safe-area-inset-right));
    bottom: max(12px, env(safe-area-inset-bottom));
    min-width: 0;
    width: 154px;
  }
  .po-toolbar {
    right: max(12px, env(safe-area-inset-right));
    bottom: calc(max(12px, env(safe-area-inset-bottom)) + 70px);
    max-width: calc(100vw - 24px);
  }
  .po-tool-btn { width: 42px; height: 42px; }
  .po-color { width: 34px; height: 34px; }
  .po-hide-btn { height: 38px; }
  .po-popover { font-size: 16px; }
  .po-popover-head { font-size: 12px; }
  .po-popover textarea { min-height: 88px; font-size: 16px; }
  .po-popover button { min-height: 38px; font-size: 13px; }
  .po-issue-panel {
    top: max(8px, env(safe-area-inset-top));
    right: max(8px, env(safe-area-inset-right));
    bottom: max(8px, env(safe-area-inset-bottom));
    width: calc(100vw - 16px);
    border-radius: 16px;
  }
  .po-issue-panel-head { padding: 14px 12px; }
  .po-issue-panel-logo { width: 42px; height: 42px; margin-right: 8px; }
  .po-issue-panel-logo svg { width: 34px; height: 34px; }
  .po-issue-panel h2 { font-size: 18px; }
  .po-issue-list { padding: 8px; }
}
`;
