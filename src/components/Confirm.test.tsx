import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { ConfirmProvider, useConfirm } from '../../components/Confirm';

function TestTrigger() {
  const confirm = useConfirm();

  const handle = async () => {
    const ok = await confirm({ title: 'Delete', description: 'Are you sure?', confirmText: 'Yes', cancelText: 'No' });
    const el = document.getElementById('result');
    if (el) el.textContent = String(ok);
  }

  return <button onClick={handle}>open</button>;
}

describe('ConfirmProvider & useConfirm', () => {
  it('resolves true when confirm clicked', async () => {
    render(<ConfirmProvider><TestTrigger /><div id="result"></div></ConfirmProvider>);
    const user = userEvent.setup();

    await user.click(screen.getByText('open'));
    await screen.findByText('Delete');
    await user.click(screen.getByText('Yes'));

    await waitFor(() => expect(document.getElementById('result')?.textContent).toBe('true'));
  });

  it('resolves false when cancel clicked', async () => {
    render(<ConfirmProvider><TestTrigger /><div id="result"></div></ConfirmProvider>);
    const user = userEvent.setup();

    await user.click(screen.getByText('open'));
    await screen.findByText('Delete');
    await user.click(screen.getByText('No'));

    await waitFor(() => expect(document.getElementById('result')?.textContent).toBe('false'));
  });
});
