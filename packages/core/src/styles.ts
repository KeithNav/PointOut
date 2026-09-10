export const STYLES = `
:host { all: initial; }
.po-root {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.po-canvas { position: absolute; top: 0; left: 0; pointer-events: none; }
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
  right: 20px;
  bottom: 20px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #111827;
  color: #fff;
  border: none;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: .05em;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(0, 0, 0, .3);
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform .15s ease;
}
.po-bubble:hover { transform: scale(1.08); }

.po-toolbar {
  position: fixed;
  right: 20px;
  bottom: 80px;
  display: flex;
  gap: 6px;
  align-items: center;
  background: rgba(17, 24, 39, .92);
  backdrop-filter: blur(6px);
  padding: 8px;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, .3);
  z-index: 2;
}

.po-tool-btn {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: 1px solid transparent;
  background: transparent;
  color: #e5e7eb;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.po-tool-btn:hover { background: rgba(255, 255, 255, .08); }
.po-tool-btn[data-active="true"] { background: #2563eb; color: #fff; }

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
  width: 240px;
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
.po-popover-actions { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
.po-resolve { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #374151; margin-right: auto; }
.po-popover button { border: none; border-radius: 7px; padding: 5px 10px; font-size: 12px; cursor: pointer; }
.po-save { background: #2563eb; color: #fff; }
.po-delete { background: #fee2e2; color: #b91c1c; }
.po-close { background: transparent; color: #6b7280; padding: 5px 7px; }
`;
