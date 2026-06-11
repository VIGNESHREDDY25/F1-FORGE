import CursorCompanion from './CursorCompanion';
import CursorGlow from './CursorGlow';
import CompanionToggle from './CompanionToggle';
import { useFxEnabled } from './useFxEnabled';

/**
 * Orchestrates all global pointer effects:
 *  - a soft cursor glow that trails the pointer
 *  - the graduation-cap cursor companion (eyes track the cursor)
 *  - a persisted on/off toggle
 *
 * Effects only render on fine-pointer devices with motion allowed, so touch
 * devices and `prefers-reduced-motion` users see nothing (and no toggle).
 */
export default function PointerFx() {
  const { supported, enabled, active, setEnabled } = useFxEnabled();

  // Touch / reduced-motion: render nothing at all (no toggle either).
  if (!supported) return null;

  return (
    <>
      {active && <CursorGlow />}
      {active && <CursorCompanion />}
      <CompanionToggle enabled={enabled} onToggle={setEnabled} />
    </>
  );
}
