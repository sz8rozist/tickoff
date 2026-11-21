/** A widget stílusai: Shadow DOM-ban élnek, így az oldal CSS-e nem érinti őket, és ők sem az oldalt. */
export const styles = `
  :host { all: initial; }
  * {
    box-sizing: border-box;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .fab, .banner, .panel, .toast, .pin, .pop, .hl { z-index: 2147483647; }

  /* Márkaszínek: egyeznek a dashboardéval */
  .fab, .btn.primary { --brand: #5b64e3; --brand-dark: #4a52c9; }

  .fab {
    position: fixed; right: 20px; bottom: 20px;
    display: inline-flex; align-items: center; gap: 8px;
    padding: 11px 18px 11px 14px; border: 0; border-radius: 999px;
    background: linear-gradient(135deg, #6b75e6 0%, #8b5cf6 100%); color: #fff;
    font-size: 14px; font-weight: 600; cursor: pointer;
    box-shadow: 0 6px 20px rgba(107,117,230,.45);
    transition: transform .15s ease, box-shadow .15s ease;
  }
  .fab::before {
    content: ""; width: 18px; height: 18px; flex: none;
    background: no-repeat center / contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5' stroke='white' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  }
  .fab:hover { transform: translateY(-1px); box-shadow: 0 8px 26px rgba(107,117,230,.55); }
  .fab:focus-visible, .btn:focus-visible, .pin:focus-visible { outline: 3px solid rgba(91,100,227,.45); outline-offset: 2px; }

  .banner {
    position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
    max-width: calc(100vw - 24px);
    padding: 9px 18px; border-radius: 999px;
    background: #1f2140; color: #fff; font-size: 13px; font-weight: 500; text-align: center;
    box-shadow: 0 6px 20px rgba(31,33,64,.35);
  }

  .hl {
    position: fixed; pointer-events: none;
    border: 2px solid #5b64e3; background: rgba(91,100,227,.12); border-radius: 4px;
  }

  /* A mélylinkkel megnyitott komment elemének kiemelése: pulzáló keret */
  .hl.spot { border-width: 3px; animation: tk-pulse 1.1s ease-in-out 3; }
  @keyframes tk-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(91, 100, 227, .55); }
    50% { box-shadow: 0 0 0 12px rgba(91, 100, 227, 0); }
  }

  .panel {
    position: fixed; right: 20px; bottom: 72px;
    width: min(360px, calc(100vw - 24px));
    padding: 18px; border-radius: 16px;
    background: #fff; color: #1f2140; font-size: 14px;
    border: 1px solid rgba(31,33,64,.08);
    box-shadow: 0 16px 48px rgba(31,33,64,.28);
  }
  .panel h2 { margin: 0 0 10px; font-size: 16px; font-weight: 700; letter-spacing: -.01em; }
  .panel .sel {
    margin: 0 0 12px; padding: 5px 10px; border-radius: 8px;
    background: #f1f2fa; color: #5a5f86; font: 12px ui-monospace, "Cascadia Code", Consolas, monospace;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .panel label { display: block; margin: 10px 0 5px; font-size: 12px; font-weight: 600; color: #3b3f66; }
  .panel input[type=text], .panel textarea {
    width: 100%; padding: 9px 12px; border: 1px solid #d5d8ec; border-radius: 10px;
    font-size: 14px; color: #1f2140; background: #fff;
    transition: border-color .12s ease, box-shadow .12s ease;
  }
  .panel textarea { min-height: 88px; resize: vertical; }
  .panel input:focus, .panel textarea:focus {
    outline: none; border-color: #5b64e3; box-shadow: 0 0 0 3px rgba(91,100,227,.2);
  }
  .panel .check { display: flex; gap: 8px; align-items: center; margin: 12px 0 0; font-weight: 400; font-size: 13px; }
  .panel .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }
  .panel .err { margin: 12px 0 0; padding: 9px 12px; border-radius: 10px; background: #fdecee; color: #b3261e; font-size: 13px; }

  .btn {
    padding: 9px 16px; border-radius: 10px; border: 1px solid #d5d8ec;
    background: #fff; color: #1f2140; font-size: 14px; font-weight: 600; cursor: pointer;
    transition: background .12s ease, border-color .12s ease;
  }
  .btn:hover { background: #f5f6fb; }
  .btn.primary { background: #5b64e3; border-color: #5b64e3; color: #fff; }
  .btn.primary:hover { background: #4a52c9; border-color: #4a52c9; }
  .btn:disabled { opacity: .55; cursor: default; }

  .toast {
    position: fixed; left: 20px; bottom: 20px; max-width: calc(100vw - 40px);
    padding: 11px 18px; border-radius: 12px;
    background: #1f2140; color: #fff; font-size: 13px; font-weight: 500;
    box-shadow: 0 6px 20px rgba(31,33,64,.35);
  }

  /* Jelölők: színük a komment állapota, egyezik a dashboardéval */
  .pin {
    position: fixed; width: 28px; height: 28px; margin: -14px 0 0 -14px;
    border: 2px solid #fff; border-radius: 50%;
    color: #fff; font-size: 12px; font-weight: 700; line-height: 24px; text-align: center;
    cursor: pointer; box-shadow: 0 3px 10px rgba(31,33,64,.4);
    padding: 0; transition: transform .12s ease;
  }
  .pin:hover { transform: scale(1.12); }
  .pin.OPEN { background: #f76707; }
  .pin.IN_PROGRESS { background: #5b64e3; }
  .pin.DONE { background: #12b886; }
  .pin.inert { pointer-events: none; }

  .pop {
    position: fixed; width: min(320px, calc(100vw - 16px)); padding: 14px; border-radius: 14px;
    max-height: min(480px, calc(100vh - 16px)); overflow-y: auto;
    background: #fff; color: #1f2140; font-size: 13px; line-height: 1.45;
    border: 1px solid rgba(31,33,64,.08);
    box-shadow: 0 16px 48px rgba(31,33,64,.28);
  }
  .pop .meta { margin-bottom: 4px; color: #6b7094; font-size: 12px; }
  .pop .body { white-space: pre-wrap; word-break: break-word; }
  .pop .status {
    display: inline-block; margin-top: 10px; padding: 2px 10px; border-radius: 999px;
    background: #f1f2fa; color: #3b3f66; font-size: 12px; font-weight: 600;
  }

  .pop .thread { margin: 12px 0 8px; padding-left: 12px; border-left: 2px solid #e3e5f3; }
  .pop .reply + .reply { margin-top: 10px; }
  .pop .badge {
    margin-left: 6px; padding: 1px 8px; border-radius: 999px;
    background: #eef0ff; color: #4a52c9; font-size: 11px; font-weight: 600;
  }

  .pop .btn.small { padding: 5px 12px; font-size: 12px; margin-top: 8px; border-radius: 8px; }
  .reply-form { margin-top: 8px; }
  .reply-form input, .reply-form textarea {
    width: 100%; margin-bottom: 6px; padding: 8px 10px;
    border: 1px solid #d5d8ec; border-radius: 8px; font-size: 13px; color: #1f2140; background: #fff;
  }
  .reply-form textarea { min-height: 64px; resize: vertical; }
  .reply-form input:focus, .reply-form textarea:focus {
    outline: none; border-color: #5b64e3; box-shadow: 0 0 0 3px rgba(91,100,227,.2);
  }
  .reply-form .actions { margin-top: 2px; display: flex; gap: 6px; justify-content: flex-end; }
  .reply-form .actions .btn.small { margin-top: 0; }
  .reply-form .err { margin: 0 0 6px; padding: 7px 10px; border-radius: 8px; background: #fdecee; color: #b3261e; font-size: 12px; }
`;
