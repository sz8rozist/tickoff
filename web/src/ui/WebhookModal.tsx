import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Code, CopyButton, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { api, ApiError, type Project, type WebhookDelivery } from './api';
import { locale, t } from './i18n';

const EVENT_LABEL = (): Record<string, string> => ({
  'comment.created': t('új visszajelzés'),
  'reply.created': t('ügyfél-válasz'),
  'comment.reopened': t('újranyitás'),
  'round.approved': t('kör jóváhagyása'),
});

function saveError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 400) return t('Érvénytelen cím: https:// kezdetű, nyilvánosan elérhető címet adj meg (belső hálózatra nem mutathat).');
    if (e.status === 403 || e.status === 404) return t('Ehhez csak a projekt tulajdonosa jogosult.');
  }
  return t('A mentés nem sikerült, próbáld újra később.');
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
  const [deliveries, setDeliveries] = useState<WebhookDelivery[] | null>(null);

  const loadDeliveries = (id: number) =>
    api.projects
      .webhookDeliveries(id)
      .then(setDeliveries)
      .catch(() => setDeliveries([]));

  // A kézbesítési napló a megnyitáskor töltődik (csak beállított webhooknál)
  useEffect(() => {
    if (opened && project?.webhookUrl) void loadDeliveries(project.id);
    else setDeliveries(null);
  }, [opened, project?.id, project?.webhookUrl]);

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
      if (project.webhookUrl) void loadDeliveries(project.id);
      setResult(
        r.ok
          ? { ok: true, text: t('A teszt-üzenet megérkezett a fogadóhoz.') }
          : { ok: false, text: r.error ?? t('A fogadó hibát jelzett.') },
      );
    } catch (e) {
      setResult({
        ok: false,
        text: e instanceof ApiError && e.status === 429 ? t('Túl sok teszt, várj egy percet.') : t('A teszt nem sikerült.'),
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={t('Webhook')} size="lg" centered>
      <Stack>
        <Text size="sm">
          {t('A csapat eseményeit (új visszajelzés, az ügyfél válasza, újranyitás, kör jóváhagyása) elküldjük erre a címre. Slack vagy Discord')}{' '}<b>{t('bejövő webhook')}</b> {t('címét közvetlenül megadhatod, saját fogadó a JSON-t kapja.')}</Text>

        <TextInput
          label={t('Webhook címe')}
          placeholder={t('https://hooks.slack.com/services/…')}
          value={url}
          maxLength={500}
          onChange={(e) => setUrl(e.currentTarget.value)}
          description={t('Csak nyilvános https-cím lehet. A cím gyakran titkot tartalmaz, ezért csak te látod.')}
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
            {t('Mentés')}</Button>
          {configured && (
            <>
              <Button variant="light" loading={testing} onClick={test}>
                {t('Teszt küldése')}</Button>
              <Button variant="subtle" color="red" loading={busy} onClick={() => save(null)}>
                {t('Kikapcsolás')}</Button>
            </>
          )}
        </Group>

        {configured && deliveries && (
          <Stack gap={6}>
            <Text size="sm" fw={600}>
              {t('Legutóbbi kézbesítések')}</Text>
            {deliveries.length === 0 ? (
              <Text size="xs" c="dimmed">
                {t('Még nem volt kézbesítés. A sikertelen küldést a rendszer háromszor újrapróbálja (10 mp, 1 perc, 5 perc múlva).')}</Text>
            ) : (
              <Stack gap={4}>
                {deliveries.map((d) => (
                  <Group key={d.id} gap="xs" wrap="nowrap" justify="space-between">
                    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                      <Badge size="sm" variant="light" color={d.ok ? 'green' : 'red'}>
                        {d.ok ? t('sikerült') : t('nem sikerült')}
                      </Badge>
                      <Text size="xs" truncate>
                        {EVENT_LABEL()[d.event] ?? d.event}
                        {d.attempts > 1 ? t(' · {attempts}. próbálkozásra', { attempts: d.attempts }) : ''}
                        {!d.ok && d.error ? ` · ${d.error}` : ''}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" style={{ flex: 'none' }}>
                      {new Date(d.createdAt).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' })}
                    </Text>
                  </Group>
                ))}
              </Stack>
            )}
          </Stack>
        )}

        {configured && project.webhookSecret && (
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              {t('Aláírási titok')}</Text>
            <Group gap="xs">
              <Code>{project.webhookSecret}</Code>
              <CopyButton value={project.webhookSecret}>
                {({ copied, copy }) => (
                  <Button variant="light" size="compact-xs" onClick={copy}>
                    {copied ? t('Másolva') : t('Másolás')}
                  </Button>
                )}
              </CopyButton>
            </Group>
            <Text size="xs" c="dimmed">
              {t('Saját fogadónál az')}{' '}<Code>{t('X-Tickoff-Signature')}</Code> {t('fejléc')}{' '}<Code>{t('sha256=…')}</Code> {t('értéke a kérés nyers törzsének HMAC-SHA256 hash-e ezzel a titokkal. Slacknél és Discordnál nincs rá szükség.')}</Text>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
