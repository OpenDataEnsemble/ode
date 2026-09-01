import { chunkItems } from '../chunkItems';

describe('chunkItems', () => {
  it('splits into batches of the requested size', () => {
    expect(chunkItems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('treats a non-positive size as 1', () => {
    expect(chunkItems(['a', 'b'], 0)).toEqual([['a'], ['b']]);
  });

  it('returns no batches for an empty list', () => {
    expect(chunkItems([], 25)).toEqual([]);
  });
});
