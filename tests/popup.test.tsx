import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../entrypoints/popup/App';
import { response, testClient } from './fixtures';

describe('popup UI and connection lifecycle', () => {
  it('renders a successful handshake and keeps historical search unavailable', async () => {
    const { client } = testClient(); render(<App client={client} />);
    expect(screen.getByRole('heading', { name: 'ChatJump' })).toBeInTheDocument();
    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search Messages' })).toBeDisabled();
    expect(screen.getByText(/Date search is not available yet/)).toBeInTheDocument();
  });
  it('never displays Connected before an actual content-script response', async () => {
    const { client } = testClient(); client.sendMessage.mockReturnValue(new Promise(() => {})); const { unmount } = render(<App client={client} />);
    await waitFor(() => expect(client.sendMessage).toHaveBeenCalled());
    expect(screen.getByText('Checking')).toBeInTheDocument(); expect(screen.queryByText('Connected')).not.toBeInTheDocument(); unmount();
  });
  it('shows unsupported sites without sending any content message', async () => {
    const { client } = testClient(); client.queryActiveTab.mockResolvedValue({ id: 7, url: 'https://example.com/', status: 'complete' }); render(<App client={client} />);
    expect(await screen.findByText('Not on Instagram')).toBeInTheDocument(); expect(client.sendMessage).not.toHaveBeenCalled();
  });
  it('explains missing content scripts and can recheck after tab reload', async () => {
    const { client } = testClient(); client.sendMessage.mockRejectedValueOnce(new Error('Receiving end does not exist')); render(<App client={client} />);
    expect(await screen.findByText('Instagram tab detected but script unavailable')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Check Connection' })); expect(await screen.findByText('Connected')).toBeInTheDocument();
  });
  it('reports browser rejections without logging raw browser errors', async () => {
    const { client } = testClient(); client.queryActiveTab.mockRejectedValue(new Error('PRIVATE URL STACK')); render(<App client={client} />);
    expect(await screen.findByText('Error')).toBeInTheDocument(); expect(document.body.textContent).not.toContain('PRIVATE');
  });
  it('explains an inaccessible active-tab URL without sending a message', async () => {
    const { client } = testClient(); client.queryActiveTab.mockResolvedValue({ id: 7 }); render(<App client={client} />);
    expect(await screen.findByText(/Chrome cannot read this tab/)).toBeInTheDocument(); expect(client.sendMessage).not.toHaveBeenCalled();
  });
  it('explains when no active tab is available', async () => {
    const { client } = testClient(); client.queryActiveTab.mockResolvedValue(undefined); render(<App client={client} />);
    expect(await screen.findByText(/No active tab was found/)).toBeInTheDocument(); expect(client.sendMessage).not.toHaveBeenCalled();
  });
  it('keeps selected dates in state and marks future/empty dates invalid', async () => {
    const { client } = testClient(); render(<App client={client} />); await screen.findByText('Connected'); const input = screen.getByLabelText('Select date');
    fireEvent.change(input, { target: { value: '2026-01-01' } }); expect(input).toHaveValue('2026-01-01'); expect(input).not.toHaveAttribute('aria-invalid');
    fireEvent.change(input, { target: { value: '9999-12-31' } }); expect(screen.getByRole('alert')).toHaveTextContent('Choose today or an earlier date.'); expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(input, { target: { value: '' } }); expect(screen.getByRole('alert')).toHaveTextContent('Select a date.');
    expect(screen.getByRole('button', { name: 'Search Messages' })).toBeDisabled();
  });
  it('supports logical keyboard focus and labels', async () => {
    const { client } = testClient(); render(<App client={client} />); await screen.findByText('Connected'); const user = userEvent.setup();
    await user.tab(); expect(screen.getByRole('button', { name: 'Check Connection' })).toHaveFocus();
    await user.tab(); expect(screen.getByLabelText('Select date')).toHaveFocus();
    expect(screen.getByLabelText('Select date')).toHaveAttribute('type', 'date');
  });
  it('refreshes on tab events and ignores stale pending responses', async () => {
    const { client, emit } = testClient(); let complete: (value: unknown) => void = () => {};
    client.sendMessage.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; })); render(<App client={client} />);
    await waitFor(() => expect(client.sendMessage).toHaveBeenCalledTimes(1));
    client.queryActiveTab.mockResolvedValue({ id: 8, url: 'https://example.com/', status: 'complete' }); act(emit);
    expect(await screen.findByText('Not on Instagram')).toBeInTheDocument(); await act(async () => complete(response));
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
  });
  it('rejects a changed tab after a successful reply', async () => {
    const { client } = testClient(); client.queryActiveTab.mockResolvedValueOnce({ id: 7, url: 'https://www.instagram.com/', status: 'complete' }).mockResolvedValue({ id: 8, url: 'https://example.com/', status: 'complete' }); render(<App client={client} />);
    expect(await screen.findByText(/active page changed/)).toBeInTheDocument(); expect(screen.queryByText('Connected')).not.toBeInTheDocument();
  });
  it('unsubscribes and cancels pending work when the popup closes', async () => {
    const { client, unsubscribe } = testClient(); client.sendMessage.mockReturnValue(new Promise(() => {})); const { unmount } = render(<App client={client} />);
    await waitFor(() => expect(client.sendMessage).toHaveBeenCalled()); unmount(); expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
