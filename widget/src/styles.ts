/** A widget stílusai: Shadow DOM-ban élnek, így az oldal CSS-e nem érinti őket, és ők sem az oldalt. */
export const styles = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }

  .fab, .banner, .panel, .toast, .pin, .pop, .hl { z-index: 2147483647; }

  .fab {
    position: fixed; right: 20px; bottom: 20px;
    padding: 10px 16px; border: 0; border-radius: 999px;
    background: #111; color: #fff; font-size: 14px; cursor: pointer;
    box-shadow: 0 4px 14px rgba(0,0,0,.25);
  }
  .fab:hover { background: #333; }

  .banner {
    position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
    max-width: calc(100vw - 24px);
    padding: 8px 16px; border-radius: 999px;
    background: #111; color: #fff; font-size: 13px; text-align: center;
    box-shadow: 0 4px 14px rgba(0,0,0,.25);
  }

  .hl {
    position: fixed; pointer-events: none;
    border: 2px solid #e53935; background: rgba(229,57,53,.12); border-radius: 2px;
  }

  .panel {
    position: fixed; right: 20px; bottom: 72px;
    width: min(340px, calc(100vw - 24px));
    padding: 14px; border-radius: 12px;
    background: #fff; color: #111; font-size: 14px;
    box-shadow: 0 8px 30px rgba(0,0,0,.28);
  }
  .panel h2 { margin: 0 0 8px; font-size: 15px; }
  .panel .sel {
    margin: 0 0 10px; padding: 4px 8px; border-radius: 6px;
    background: #f3f3f3; color: #555; font: 12px ui-monospace, Consolas, monospace;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .panel label { display: block; margin: 8px 0 4px; font-size: 12px; font-weight: 600; color: #444; }
  .panel input[type=text], .panel textarea {
    width: 100%; padding: 8px 10px; border: 1px solid #c9c9c9; border-radius: 8px;
    font-size: 14px; color: #111; background: #fff;
  }
  .panel textarea { min-height: 84px; resize: vertical; }
  .panel input:focus, .panel textarea:focus { outline: 2px solid #1c7ed6; outline-offset: 0; border-color: #1c7ed6; }
  .panel .check { display: flex; gap: 8px; align-items: center; margin: 10px 0 0; font-weight: 400; font-size: 13px; }
  .panel .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
  .panel .err { margin: 10px 0 0; padding: 8px 10px; border-radius: 8px; background: #fdecea; color: #b00020; font-size: 13px; }

  .btn {
    padding: 8px 14px; border-radius: 8px; border: 1px solid #c9c9c9;
    background: #fff; color: #111; font-size: 14px; cursor: pointer;
  }
  .btn.primary { background: #1c7ed6; border-color: #1c7ed6; color: #fff; }
  .btn:disabled { opacity: .6; cursor: default; }

  .toast {
    position: fixed; left: 20px; bottom: 20px; max-width: calc(100vw - 40px);
    padding: 10px 16px; border-radius: 10px;
    background: #111; color: #fff; font-size: 13px;
    box-shadow: 0 4px 14px rgba(0,0,0,.25);
  }

  .pin {
    position: fixed; width: 26px; height: 26px; margin: -13px 0 0 -13px;
    border: 2px solid #fff; border-radius: 50%;
    color: #fff; font-size: 12px; font-weight: 700; line-height: 22px; text-align: center;
    cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.35);
    padding: 0;
  }
  .pin.OPEN { background: #e53935; }
  .pin.IN_PROGRESS { background: #fb8c00; }
  .pin.DONE { background: #43a047; }
  .pin.inert { pointer-events: none; }

  .pop {
    position: fixed; width: min(300px, calc(100vw - 16px)); padding: 12px; border-radius: 10px;
    max-height: min(480px, calc(100vh - 16px)); overflow-y: auto;
    background: #fff; color: #111; font-size: 13px;
    box-shadow: 0 8px 30px rgba(0,0,0,.28);
  }
  .pop .meta { margin-bottom: 4px; color: #666; font-size: 12px; }
  .pop .body { white-space: pre-wrap; word-break: break-word; }
  .pop .status { margin-top: 8px; font-size: 12px; font-weight: 600; }

  .pop .thread { margin: 10px 0 8px; padding-left: 10px; border-left: 2px solid #e1e1e1; }
  .pop .reply + .reply { margin-top: 8px; }
  .pop .badge {
    margin-left: 6px; padding: 1px 6px; border-radius: 999px;
    background: #e7f1fb; color: #1c7ed6; font-size: 11px; font-weight: 600;
  }

  .pop .btn.small { padding: 4px 10px; font-size: 12px; margin-top: 8px; }
  .reply-form { margin-top: 8px; }
  .reply-form input, .reply-form textarea {
    width: 100%; margin-bottom: 6px; padding: 6px 8px;
    border: 1px solid #c9c9c9; border-radius: 6px; font-size: 13px; color: #111; background: #fff;
  }
  .reply-form textarea { min-height: 64px; resize: vertical; }
  .reply-form input:focus, .reply-form textarea:focus { outline: 2px solid #1c7ed6; border-color: #1c7ed6; }
  .reply-form .actions { margin-top: 2px; display: flex; gap: 6px; justify-content: flex-end; }
  .reply-form .actions .btn.small { margin-top: 0; }
  .reply-form .err { margin: 0 0 6px; padding: 6px 8px; border-radius: 6px; background: #fdecea; color: #b00020; font-size: 12px; }
`;
