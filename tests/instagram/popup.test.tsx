import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../entrypoints/popup/App';
import { emptySnapshot } from '../../src/adapters/instagram/InstagramAdapter';
import { testClient, response } from '../fixtures';
import { fixture } from './fixtures';

describe('conversation metadata popup', () => {
  it('shows actual confirmed rendered counts and calendar dates', async () => {
    const { adapter } = fixture(['2026-11-04', '2026-10-15']); const { client } = testClient();
    client.sendMessage.mockImplementation(async (_id, message) => message.type === 'GET_CONNECTION_STATUS' ? response : { success: true, type: message.type, snapshot: adapter.getSnapshot() });
    render(<App client={client} />); expect(await screen.findByText('Detected', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('2', { exact: true })).toBeInTheDocument(); expect(screen.getByText('2026-10-15')).toBeInTheDocument(); expect(screen.getByText('2026-11-04')).toBeInTheDocument();
    expect(screen.getByText('Complete for rendered messages')).toBeInTheDocument(); expect(screen.getByText(/History completeness is unknown/)).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Search Messages' })).toBeDisabled(); adapter.cleanup();
  });
  it.each([['not-open', 'NO_CONVERSATION', 'No conversation selected'], ['unsupported-layout', 'UNVERIFIED_SELECTORS', 'Unsupported layout']] as const)('reports %s without inventing counts', async (status, reason, label) => {
    const { client } = testClient(); client.sendMessage.mockImplementation(async (_id, message) => message.type === 'GET_CONNECTION_STATUS' ? response : { success: true, type: message.type, snapshot: emptySnapshot(status, 'unverified', reason) });
    render(<App client={client} />); expect(await screen.findByText(label, { exact: true })).toBeInTheDocument(); expect(screen.queryByText('0', { exact: true })).not.toBeInTheDocument();
  });
  it('does not confuse an invalid summary with a connection failure', async () => {
    const { client } = testClient(); client.sendMessage.mockImplementation(async (_id, message) => message.type === 'GET_CONNECTION_STATUS' ? response : { success: true, type: message.type, snapshot: { message: 'PRIVATE BODY' } });
    const { container } = render(<App client={client} />); expect(await screen.findByText(/incompatible response/)).toBeInTheDocument(); expect(screen.getByText('Connected', { exact: true })).toBeInTheDocument(); expect(container.textContent).not.toContain('PRIVATE BODY');
  });
  it('hides a prior tab snapshot while a new tab summary is pending', async () => {
    const { adapter } = fixture(['2026-10-15']); const { client, emit } = testClient();
    client.sendMessage.mockImplementation(async (_id, message) => message.type === 'GET_CONNECTION_STATUS' ? response : { success: true, type: message.type, snapshot: adapter.getSnapshot() });
    render(<App client={client} />); await screen.findByText('Detected', { exact: true });
    client.queryActiveTab.mockResolvedValue({ id: 8, url: 'https://www.instagram.com/direct/t/new-synthetic/', status: 'complete' });
    client.sendMessage.mockImplementation(async (_id, message) => message.type === 'GET_CONNECTION_STATUS' ? response : new Promise(() => {}));
    act(emit); await waitFor(() => expect(screen.queryByText('2026-10-15')).not.toBeInTheDocument()); adapter.cleanup();
  });
});
