import TokenAvatar from './avatar';

test('Avatar create new instance', () => {
    const avatar = new TokenAvatar('example');
    expect(avatar.hash).toBe('50d858e0985ecc7f60418aaf0cc5ab587f42c2570a884095a9e8ccacd0f6545c');
    expect(avatar.colors.length).toBe(60);
});
