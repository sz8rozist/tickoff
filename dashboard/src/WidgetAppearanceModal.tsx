import { useEffect, useState } from 'react';
import { Alert, Button, ColorInput, Group, Modal, SegmentedControl, Stack, Text } from '@mantine/core';
import { api, ApiError, type Project } from './api';

const DEFAULT_COLOR = '#5b64e3';
const SWATCHES = ['#5b64e3', '#e03131', '#f76707', '#2f9e44', '#1c7ed6', '#9c36b5', '#d6336c', '#1f2140'];

/** A widget megjelenése: márkaszín és a gombok oldala, élő előnézettel. Csak a tulajdonos állíthatja. */
export function WidgetAppearanceModal({
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
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [position, setPosition] = useState<'RIGHT' | 'LEFT'>('RIGHT');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setColor(project?.widgetColor ?? DEFAULT_COLOR);
      setPosition(project?.widgetPosition ?? 'RIGHT');
      setError(null);
    }
  }, [opened, project?.id, project?.widgetColor, project?.widgetPosition]);

  if (!project) return null;

  async function save(nextColor: string | null) {
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      onChanged(await api.projects.setWidgetAppearance(project.id, nextColor, position));
      onClose();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 400
          ? 'Túl világos szín: a gombokon fehér szöveg van, és olvashatatlan lenne. Válassz sötétebbet.'
          : 'A mentés nem sikerült, próbáld újra később.',
      );
    } finally {
      setBusy(false);
    }
  }

  const valid = /^#[0-9a-fA-F]{6}$/.test(color);

  return (
    <Modal opened={opened} onClose={onClose} title="A widget megjelenése" centered>
      <Stack>
        <Text size="sm">A widget az ügyfeled oldalán a te arculatodhoz igazodik: a gomb és a kiemelések színe, valamint a gombok oldala.</Text>

        <ColorInput
          label="Márkaszín"
          format="hex"
          value={color}
          onChange={setColor}
          swatches={SWATCHES}
          withEyeDropper={false}
          description="A gombokon fehér szöveg van, ezért sötétebb, telített szín való."
        />

        <div>
          <Text size="sm" fw={500} mb={4}>
            A gombok helye
          </Text>
          <SegmentedControl
            fullWidth
            value={position}
            onChange={(v) => setPosition(v as 'RIGHT' | 'LEFT')}
            data={[
              { value: 'RIGHT', label: 'Jobb alul' },
              { value: 'LEFT', label: 'Bal alul' },
            ]}
          />
        </div>

        {/* Előnézet: a widget fő gombja a választott színnel és oldallal */}
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            justifyContent: position === 'RIGHT' ? 'flex-end' : 'flex-start',
            padding: 16,
            borderRadius: 12,
            background: 'var(--mantine-color-default-hover)',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 18px',
              borderRadius: 999,
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              background: valid ? `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color}, black 28%))` : DEFAULT_COLOR,
              boxShadow: '0 6px 20px rgba(31,33,64,.25)',
            }}
          >
            ✓ Visszajelzés
          </span>
        </div>

        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        <Group justify="space-between">
          <Button variant="subtle" color="gray" disabled={busy} onClick={() => save(null)}>
            Alapértelmezett szín
          </Button>
          <Group>
            <Button variant="default" onClick={onClose}>
              Mégse
            </Button>
            <Button loading={busy} disabled={!valid} onClick={() => save(color.toLowerCase())}>
              Mentés
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
