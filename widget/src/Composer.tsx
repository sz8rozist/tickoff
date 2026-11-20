import { useEffect, useRef, useState } from 'react';

export interface ComposerValues {
  authorName: string;
  body: string;
  includeScreenshot: boolean;
}

export function Composer({
  selector,
  defaultName,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  selector: string;
  defaultName: string;
  busy: boolean;
  error: string | null;
  onSubmit: (values: ComposerValues) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [body, setBody] = useState('');
  const [shot, setShot] = useState(true);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Ha már ismerjük a nevet, a szövegmezőre érkezik a fókusz, különben a névre.
  useEffect(() => {
    (defaultName ? bodyRef.current : nameRef.current)?.focus();
  }, [defaultName]);

  const valid = name.trim() !== '' && body.trim() !== '';

  function submit(e: Event) {
    e.preventDefault();
    if (valid && !busy) onSubmit({ authorName: name.trim(), body: body.trim(), includeScreenshot: shot });
  }

  return (
    <form class="panel" role="dialog" aria-label="Új visszajelzés" onSubmit={submit}>
      <h2>Új visszajelzés</h2>
      <p class="sel" title={selector}>
        {selector}
      </p>

      <label for="tk-name">A neved</label>
      <input
        id="tk-name"
        type="text"
        ref={nameRef}
        value={name}
        maxLength={120}
        autocomplete="name"
        onInput={(e) => setName(e.currentTarget.value)}
      />

      <label for="tk-body">Mit szeretnél módosítani?</label>
      <textarea
        id="tk-body"
        ref={bodyRef}
        value={body}
        maxLength={4000}
        placeholder="Pl.: ez a gomb mobilon kilóg a képből"
        onInput={(e) => setBody(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
        }}
      />

      <label class="check">
        <input type="checkbox" checked={shot} onChange={(e) => setShot(e.currentTarget.checked)} />
        Képernyőkép csatolása
      </label>

      {error && (
        <p class="err" role="alert">
          {error}
        </p>
      )}

      <div class="actions">
        <button type="button" class="btn" onClick={onCancel} disabled={busy}>
          Mégse
        </button>
        <button type="submit" class="btn primary" disabled={!valid || busy}>
          {busy ? 'Küldés…' : 'Küldés'}
        </button>
      </div>
    </form>
  );
}
