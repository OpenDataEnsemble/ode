import { QrcodeRequestCoordinator } from '../QrcodeRequestCoordinator';

describe('QrcodeRequestCoordinator', () => {
  it('rejects a second request while the scanner is open', async () => {
    const coordinator = new QrcodeRequestCoordinator();
    void coordinator.request('field-a');

    const second = await coordinator.request('field-b');
    expect(second).toEqual({
      fieldId: 'field-b',
      status: 'error',
      message: 'QR scanner is already open',
    });
  });

  it('settles the active request once', async () => {
    const coordinator = new QrcodeRequestCoordinator();
    const promise = coordinator.request('field-a');

    coordinator.settle({ fieldId: 'field-a', status: 'success', data: 'x' });
    coordinator.settle({ fieldId: 'field-a', status: 'cancelled' });

    await expect(promise).resolves.toEqual({
      fieldId: 'field-a',
      status: 'success',
      data: 'x',
    });
  });

  it('cancels with a cancelled status', async () => {
    const coordinator = new QrcodeRequestCoordinator();
    const promise = coordinator.request('field-a');

    coordinator.cancel('field-a');

    await expect(promise).resolves.toEqual({
      fieldId: 'field-a',
      status: 'cancelled',
      message: 'QR scan cancelled',
    });
  });
});
