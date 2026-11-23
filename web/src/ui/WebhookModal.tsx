import { useEffect, useState } from 'react';
import { Alert, Button, Code, CopyButton, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { api, ApiError, type Project } from './api';

function saveError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 400) return 'Érvénytelen cím: https:// kezdetű, nyilvánosan elérhető címet adj meg (belső hálózatra nem mutathat).';
    if (e.status === 403 || e.status === 404) return 'Ehhez csak a projekt tulajdonosa jogosult.';
  }
  return 'A mentés nem sikerült, próbáld újra később.';
}

/**
 * A projekt webhookja: a csapat eseményei (új komment, ügyfél-válasz, újranyitás, jóváhagyás) ide érkeznek.
 * A tartalom Slack és Discord bejövő webhookjával közvetlenül működik. Csak a tulajdonos látja és állíthatja.
 */
export function WebhookModal({
  project,
  opened,
  onClose,
  onChanged,
}: {
  project: Project | null;
  opened: boolean;
  onClose: () => void;
  onChanged: (updated: Project) => void;
}) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Megnyitáskor a mentett címmel indulunk
  useEffect(() => {
    if (opened) {
      setUrl(project?.webhookUrl ?? '');
      setError(null);
      setResult(null);
    }
  }, [opened, project?.id, project?.webhookUrl]);

  if (!project) return null;
  const configured = project.webhookUrl !== null;

  async function save(next: string | null) {
    if (!project) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      onChanged(await api.projects.setWebhook(project.id, next));
    } catch (e) {
      setError(saveError(e));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    if (!project) return;
    setTesting(true);
    setResult(null);
    try {
      const r = await api.projects.testWebhook(project.id);
      setResult(
        r.ok
          ? { ok: true, text: 'A teszt-üzenet megérkezett a fogadóhoz.' }
          : { ok: false, text: r.error ?? 'A fogadó hibát jelzett.' },
      );
    } catch (e) {
      setResult({
        ok: false,
        text: e instanceof ApiError && e.status === 429 ? 'Túl sok teszt, várj egy percet.' : 'A teszt nem sikerült.',
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Webhook" size="lg" centered>
      <Stack>
        <Text size="sm">
          A csapat eseményeit (új visszajelzés, az ügyfél válasza, újranyitás, kör jóváhagyása) elküldjük erre a címre.
          Slack vagy Discord <b>bejövő webhook</b> címét közvetlenül megadhatod, saját fogadó a JSON-t kapja.
        </Text>

        <TextInput
          label="Webhook címe"
          placeholder="https://hooks.slack.com/services/…"
          value={url}
          maxLength={500}
          onChange={(e) => setUrl(e.currentTarget.value)}
          description="Csak nyilvános https-cím lehet. A cím gyakran titkot tartalmaz, ezért csak te látod."
        />

        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        {result && (
          <Alert color={result.ok ? 'green' : 'red'} role="status">
            {result.text}
          </Alert>
        )}

        <Group>
          <Button loading={busy} disabled={url.trim() === '' || url.trim() === project.webhookUrl} onClick={() => save(url.trim())}>
            Mentés
          </Button>
          {configured && (
            <>
              <Button variant="light" loading={testing} onClick={test}>
                Teszt küldése
              </Button>
              <Button variant="subtle" color="red" loading={busy} onClick={() => save(null)}>
                Kikapcsolás
              </Button>
            </>
          )}
        </Group>

        {configured && project.webhookSecret && (
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              Aláírási titok
            </Text>
            <Group gap="xs">
              <Code>{project.webhookSecret}</Code>
              <CopyButton value={project.webhookSecret}>
                {({ copied, copy }) => (
                  <Button variant="light" size="compact-xs" onClick={copy}>
                    {copied ? 'Másolva' : 'Másolás'}
                  </Button>
                )}
              </CopyButton>
            </Group>
            <Text size="xs" c="dimmed">
              Saját fogadónál az <Code>X-Tickoff-Signature</Code> fejléc <Code>sha256=…</Code> értéke a kérés nyers
              törzsének HMAC-SHA256 hash-e ezzel a titokkal. Slacknél és Discordnál nincs rá szükség.
            </Text>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
