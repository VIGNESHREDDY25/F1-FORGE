import { Sparkles } from 'lucide-react';

interface Props {
  enabled: boolean;
  onToggle: (next: boolean) => void;
}

/** Small, unobtrusive bottom-right control to switch the cursor companion
 *  on/off. State is persisted by the parent via localStorage. */
export default function CompanionToggle({ enabled, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!enabled)}
      aria-pressed={enabled}
      title={enabled ? 'Hide cursor buddy' : 'Show cursor buddy'}
      className="fixed bottom-4 right-4 z-[80] inline-flex h-9 w-9 items-center justify-center
                 rounded-full border border-gray-200 bg-white/80 text-gray-500 shadow-sm backdrop-blur
                 transition-all hover:scale-105 hover:text-brand-600 hover:shadow-md
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
                 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-400 dark:hover:text-brand-300"
    >
      <Sparkles
        className={`h-4 w-4 transition-opacity ${enabled ? 'opacity-100' : 'opacity-40'}`}
      />
      <span className="sr-only">Toggle cursor companion</span>
    </button>
  );
}
