import { Group, Text } from '@mantine/core';

/** A Tickoff jele: kipipált négyzet. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none">
        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Wordmark({ size = 32 }: { size?: number }) {
  return (
    <Group gap={10} wrap="nowrap">
      <Logo size={size} />
      <Text className="wordmark" fw={800} fz={size * 0.62} lh={1}>
        Tickoff
      </Text>
    </Group>
  );
}
