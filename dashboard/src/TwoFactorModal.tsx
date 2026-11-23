import { useEffect, useState } from 'react';
import { Alert, Button, Code, CopyButton, Group, Image, Modal, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import QRCode from 'qrcode';
import { api, ApiError, type User } from './api';

/**
 * A kétlépcsős belépés (hitelesítő alkalmazás, TOTP) kezelése: bekapcsolás QR-kóddal és megerősítő kóddal, egyszeri
 * helyreállító kódok, kikapcsolás jelszóval és kóddal.
 */
export function TwoFactorModal({
  user,
  opened,
  onClose,
  onChanged,
}: {
  user: User;
  opened: boolean;
  onClose: () => void;
  onChanged: (user: User) => void;
}) {
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bezáráskor a félbehagyott beállítás és a kijelzett kódok eltűnnek
  useEffect(() => {
    if (!opened) {
      setSetup(null);
      setCode('');
      setPassword('');
      setRecovery(null);
      setError(null);
    }
  }, [opened]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const s = await api.twoFactor.setup();
      setSetup({ secret: s.secret, qr: await QRCode.toDataURL(s.otpauthUri, { margin: 1, width: 220 }) });
    } catch {
      setError('A beállítás indítása nem sikerült.');
    } finally {
      setBusy(false);
    }
  }

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.twoFactor.enable(code.trim());
      setRecovery(r.recoveryCodes);
      setSetup(null);
      setCode('');
      onChanged(await api.me());
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 400
          ? 'Hibás kód. Ellenőrizd, hogy az alkalmazás aktuális, 6 jegyű kódját írtad be.'
          : e instanceof ApiError && e.status === 429
            ? 'Túl sok próbálkozás. Várj egy percet.'
            : 'A bekapcsolás nem sikerült.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      await api.twoFactor.disable(password, code.trim());
      setCode('');
      setPassword('');
      onChanged(await api.me());
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 403
          ? 'Hibás jelszó.'
          : e instanceof ApiError && e.status === 400
            ? 'Hibás kód.'
            : e instanceof ApiError && e.status === 429
              ? 'Túl sok próbálkozás. Várj egy percet.'
              : 'A kikapcsolás nem sikerült.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Kétlépcsős belépés" centered>
      <Stack>
        {recovery ? (
          <>
            <Alert color="teal" title="Bekapcsolva">
              Mostantól belépéskor a jelszó mellett a hitelesítő alkalmazás kódját is meg kell adni.
            </Alert>
            <Text size="sm">
              <b>Mentsd el a helyreállító kódokat</b> biztonságos helyre. Ha elveszted a telefonod, ezekkel léphetsz be.
              Mindegyik csak egyszer használható, és később nem jeleníthetők meg újra.
            </Text>
            <Group gap="xs">
              {recovery.map((c) => (
                <Code key={c}>{c}</Code>
              ))}
            </Group>
            <CopyButton value={recovery.join('\n')}>
              {({ copied, copy }) => (
                <Button variant="light" onClick={copy}>
                  {copied ? 'Másolva' : 'Kódok másolása'}
                </Button>
              )}
            </CopyButton>
            <Button onClick={onClose}>Kész, elmentettem</Button>
          </>
        ) : user.twoFactorEnabled ? (
          <>
            <Alert color="teal">A kétlépcsős belépés be van kapcsolva.</Alert>
            <Text size="sm">A kikapcsoláshoz add meg a jelszavad és egy kódot (hitelesítő alkalmazásé vagy helyreállító).</Text>
            <PasswordInput label="Jelszó" value={password} onChange={(e) => setPassword(e.currentTarget.value)} autoComplete="current-password" />
            <TextInput label="Kód" value={code} onChange={(e) => setCode(e.currentTarget.value)} autoComplete="one-time-code" />
            {error && (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            )}
            <Button color="red" variant="light" loading={busy} disabled={password === '' || code.trim() === ''} onClick={disable}>
              Kikapcsolás
            </Button>
          </>
        ) : setup ? (
          <>
            <Text size="sm">
              1. Olvasd be a QR-kódot egy hitelesítő alkalmazással (pl. Google Authenticator, Authy, 1Password).
            </Text>
            <Image src={setup.qr} alt="QR-kód a hitelesítő alkalmazáshoz" w={220} h={220} style={{ alignSelf: 'center' }} />
            <Text size="xs" c="dimmed" ta="center">
              Ha nem tudod beolvasni, írd be a kulcsot kézzel: <Code>{setup.secret}</Code>
            </Text>
            <Text size="sm">2. Írd be az alkalmazás által mutatott 6 jegyű kódot a megerősítéshez.</Text>
            <TextInput
              label="Kód"
              placeholder="123456"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              autoComplete="one-time-code"
              data-autofocus
            />
            {error && (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setSetup(null)}>
                Mégse
              </Button>
              <Button loading={busy} disabled={!/^\d{6}$/.test(code.trim())} onClick={enable}>
                Bekapcsolás
              </Button>
            </Group>
          </>
        ) : (
          <>
            <Text size="sm">
              A kétlépcsős belépés extra védelmet ad: a jelszón kívül egy, a telefonod hitelesítő alkalmazásában
              megjelenő 6 jegyű kódot is meg kell adni belépéskor. Így a jelszó ellopása önmagában nem elég.
            </Text>
            {error && (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            )}
            <Button loading={busy} onClick={start}>
              Bekapcsolás
            </Button>
          </>
        )}
      </Stack>
    </Modal>
  );
}
