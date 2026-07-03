import * as argon from 'argon2';

export const hashingService = {
  async hash(password: string): Promise<string> {
    return argon.hash(password, {
      type: argon.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
  },

  async compare(password: string, passwordHash: string): Promise<boolean> {
    try {
      return await argon.verify(passwordHash, password);
    } catch {
      return false;
    }
  },
};
