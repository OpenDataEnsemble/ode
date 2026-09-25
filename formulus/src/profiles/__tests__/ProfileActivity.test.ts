import { ProfileActivity, ProfileBusyError } from '../ProfileActivity';
const { deferred } = require('./fixtures/profileHarness.cjs');

test('nested operations retain the outer idle gate even after the inner operation finishes', async () => {
  const activity = new ProfileActivity();
  const innerDone = deferred();
  const outerDone = deferred();
  const outer = activity.run('outer save', async () => {
    await activity.run('inner storage', async () => {
      expect(activity.isBusy()).toBe(true);
      expect(() => activity.beginTransition()).toThrow(ProfileBusyError);
    });
    innerDone.resolve();
    await outerDone.promise;
  });
  await innerDone.promise;
  expect(activity.isBusy()).toBe(true);
  expect(() => activity.beginTransition()).toThrow(ProfileBusyError);
  outerDone.resolve();
  await outer;
  expect(activity.isBusy()).toBe(false);
  activity.beginTransition();
  const work = jest.fn();
  await expect(activity.run('too late', work)).rejects.toBeInstanceOf(
    ProfileBusyError,
  );
  expect(work).not.toHaveBeenCalled();
});

test('equal labels are independent activity tokens', async () => {
  const activity = new ProfileActivity();
  const first = deferred();
  const second = deferred();
  const one = activity.run('save', () => first.promise);
  const two = activity.run('save', () => second.promise);
  first.resolve('first');
  expect(await one).toBe('first');
  expect(() => activity.beginTransition()).toThrow(ProfileBusyError);
  second.resolve('second');
  expect(await two).toBe('second');
  expect(activity.isBusy()).toBe(false);
});

test('sync throws and async rejections release operation tokens', async () => {
  const activity = new ProfileActivity();
  await expect(
    activity.run('sync', () => {
      throw new Error('sync error');
    }),
  ).rejects.toThrow('sync error');
  await expect(
    activity.run('async', async () => {
      throw new Error('async error');
    }),
  ).rejects.toThrow('async error');
  expect(activity.isBusy()).toBe(false);
  activity.beginTransition();
  expect(() => activity.assertAvailable()).toThrow(ProfileBusyError);
  activity.cancelTransition();
  expect(await activity.run('recovered', async () => 42)).toBe(42);
});

test('independent form and picker blockers prevent transitions but allow their saves to complete', async () => {
  const activity = new ProfileActivity();
  activity.setBlocker('form', true);
  activity.setBlocker('picker', true);
  expect(await activity.run('save draft', async () => 'saved')).toBe('saved');
  activity.setBlocker('form', false);
  expect(() => activity.beginTransition()).toThrow(ProfileBusyError);
  activity.setBlocker('picker', false);
  activity.beginTransition();
  expect(() => activity.beginTransition()).toThrow(ProfileBusyError);
  expect(() => activity.assertAvailable()).toThrow(ProfileBusyError);
});
