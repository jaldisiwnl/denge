import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { expiresAtMs, listWishlist } from '../../db/repo/wishlist';

/** Expired cooldowns badge (§9.7.2) → Soğuma segment. */
export function CooldownBadgeCard() {
  const navigate = useNavigate();
  const count = useLiveQuery(async () => {
    const items = await listWishlist();
    const now = Date.now();
    return items.filter((i) => i.status === 'bekliyor' && expiresAtMs(i) <= now)
      .length;
  });
  if (!count) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/islemler', { state: { segment: 'soguma' } })}
      className="w-full rounded-card border border-grid bg-card p-4 text-left"
    >
      <p className="text-base text-ink">
        ⏳ {ti(tr.cooldown.badge, { count: String(count) })}
      </p>
    </button>
  );
}
