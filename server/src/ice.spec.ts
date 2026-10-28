import { iceServers } from './ice';

describe('iceServers', () => {
  it('is STUN only without TURN config', () => {
    expect(iceServers({})).toEqual([{ urls: 'stun:stun.l.google.com:19302' }]);
  });

  it('signs time-limited TURN credentials', () => {
    const [, turn] = iceServers(
      {
        TURN_URLS: 'turn:t.example:3478, turns:t.example:5349',
        TURN_SECRET: 's3cret',
      },
      1_700_000_000_000,
    );
    expect(turn).toEqual({
      urls: ['turn:t.example:3478', 'turns:t.example:5349'],
      username: '1700021600',
      // echo -n 1700021600 | openssl dgst -sha1 -hmac s3cret -binary | base64
      credential: '2vVy4YNzKkhELRc8+RgKlKQkdmo=',
    });
  });
});
