/** Browser-test entry only. Never imported by WXT production entrypoints. */
import { InstagramAdapter } from '../../src/adapters/instagram/InstagramAdapter';
import { profile } from '../instagram/fixtures';

export function create(): InstagramAdapter {
  return new InstagramAdapter(document, profile());
}
