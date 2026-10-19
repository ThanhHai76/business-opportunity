import { AiQuota } from '../../services/billing.service';
import { quotaView } from './ai-quota.view';

const signedIn: AiQuota = { charged: null, reason: null, signedIn: true };

describe('quotaView', () => {
  it('shows nothing when the server does not meter AI answers', () => {
    expect(quotaView(undefined, 'vi', 3)).toBeNull();
    expect(quotaView(null, 'en', 3)).toBeNull();
  });

  it('shows the free allowance of the asked tool, not the common one', () => {
    const common = quotaView({ ...signedIn, charged: 'free', freePerDay: 3, freeLeft: 1 }, 'vi', 3);
    expect(common?.text).toContain('còn 1/3 lượt miễn phí');
    const story = quotaView({ ...signedIn, charged: 'free', freePerDay: 3, freeLeft: 1, toolFreePerDay: 5, toolFreeLeft: 4 }, 'vi', 3);
    expect(story?.text).toContain('còn 4/5 lượt miễn phí');
    expect(story?.basic).toBeFalse();
  });

  it('tells a visitor how many free answers signing in gives for that tool', () => {
    const view = quotaView({ charged: null, reason: 'signin', signedIn: false, toolFreePerDay: 5 }, 'en', 3);
    expect(view).toEqual({ text: 'This is the basic answer (no AI). Sign in for 5 free in-depth AI answers a day.', basic: true, action: 'signin' });
  });

  it('offers to buy when nothing is left, and says nothing was used when the AI failed', () => {
    expect(quotaView({ ...signedIn, reason: 'no_quota' }, 'vi', 3)?.action).toBe('buy');
    const failed = quotaView({ ...signedIn, reason: 'unavailable' }, 'vi', 3);
    expect(failed?.action).toBeNull();
    expect(failed?.basic).toBeTrue();
  });
});
