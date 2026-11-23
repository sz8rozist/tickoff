import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';

export interface ComposerValues {
  authorName: string;
  body: string;
  includeScreenshot: boolean;
  /** Üres, ha az ügyfél nem kér értesítést. */
  email: string;
  /** A csatolt képek (legfeljebb {@link MAX_FILES}). */
  files: File[];
}

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function Composer({
  selector,
  defaultName,
  defaultEmail,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  selector: string;
  defaultName: string;
  defaultEmail: string;
  busy: boolean;
  error: string | null;
  onSubmit: (values: ComposerValues) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [body, setBody] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [shot, setShot] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Ha már ismerjük a nevet, a szövegmezőre érkezik a fókusz, különben a névre.
  useEffect(() => {
    (defaultName ? bodyRef.current : nameRef.current)?.focus();
  }, [defaultName]);

  const emailOk = email.trim() === '' || /^\S+@\S+\.\S+$/.test(email.trim());
  const valid = name.trim() !== '' && body.trim() !== '' && emailOk;

  function addFiles(list: FileList | null) {
    if (!list) return;
    let next = [...files];
    let problem: string | null = null;
    for (const f of Array.from(list)) {
      if (!ALLOWED_TYPES.includes(f.type)) problem = t('Csak PNG, JPEG, GIF vagy WebP kép csatolható.');
      else if (f.size > MAX_FILE_BYTES) problem = t('"{name}" túl nagy (legfeljebb 3 MB).', { name: f.name });
      else if (next.length >= MAX_FILES) problem = t('Legfeljebb {max} kép csatolható.', { max: MAX_FILES });
      else next.push(f);
    }
    setFiles(next);
    setFileError(problem);
  }

  function submit(e: Event) {
    e.preventDefault();
    if (valid && !busy) onSubmit({ authorName: name.trim(), body: body.trim(), includeScreenshot: shot, email: email.trim(), files });
  }

  return (
    <form class="panel" role="dialog" aria-label={t('Új visszajelzés')} onSubmit={submit}>
      <h2>{t('Új visszajelzés')}</h2>
      <p class="sel" title={selector}>
        {selector}
      </p>

      <label for="tk-name">{t('A neved')}</label>
      <input
        id="tk-name"
        type="text"
        ref={nameRef}
        value={name}
        maxLength={120}
        autocomplete="name"
        onInput={(e) => setName(e.currentTarget.value)}
      />

      <label for="tk-body">{t('Mit szeretnél módosítani?')}</label>
      <textarea
        id="tk-body"
        ref={bodyRef}
        value={body}
        maxLength={4000}
        placeholder={t('Pl.: ez a gomb mobilon kilóg a képből')}
        onInput={(e) => setBody(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
        }}
      />

      <label for="tk-email">{t('E-mail (nem kötelező)')}</label>
      <input
        id="tk-email"
        type="email"
        value={email}
        maxLength={254}
        autocomplete="email"
        placeholder={t('Ide írunk, ha válaszolunk')}
        aria-invalid={!emailOk}
        onInput={(e) => setEmail(e.currentTarget.value)}
      />
      {!emailOk && <p class="hint bad">{t('Ez nem tűnik érvényes e-mail-címnek.')}</p>}

      <label for="tk-files">{t('Képek csatolása (nem kötelező)')}</label>
      <input
        id="tk-files"
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        multiple
        onChange={(e) => {
          addFiles(e.currentTarget.files);
          e.currentTarget.value = '';
        }}
      />
      {files.length > 0 && (
        <ul class="files">
          {files.map((f, i) => (
            <li key={f.name + i}>
              <span class="fname" title={f.name}>
                {f.name}
              </span>
              <span class="fsize">{kb(f.size)}</span>
              <button
                type="button"
                class="x"
                aria-label={t('Eltávolítás: {name}', { name: f.name })}
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {fileError && <p class="hint bad">{fileError}</p>}

      <label class="check">
        <input type="checkbox" checked={shot} onChange={(e) => setShot(e.currentTarget.checked)} />
        {t('Képernyőkép csatolása')}
      </label>

      {error && (
        <p class="err" role="alert">
          {error}
        </p>
      )}

      <div class="actions">
        <button type="button" class="btn" onClick={onCancel} disabled={busy}>
          {t('Mégse')}
        </button>
        <button type="submit" class="btn primary" disabled={!valid || busy}>
          {busy ? t('Küldés…') : t('Küldés')}
        </button>
      </div>
    </form>
  );
}
