import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let bcrypt;

try {
  const bcryptModule = await import('bcrypt');
  bcrypt = bcryptModule.default;
} catch (error) {
  const missingLegacyLoader =
    error?.code === 'MODULE_NOT_FOUND' &&
    error?.message?.includes('@mapbox/node-pre-gyp');

  if (!missingLegacyLoader) {
    throw error;
  }

  // bcrypt 5's native binary is already installed; only its path resolver is missing.
  const binding = require('../node_modules/bcrypt/lib/binding/napi-v3/bcrypt_lib.node');

  const genSalt = (rounds = 10, minor = 'b') =>
    new Promise((resolve, reject) => {
      crypto.randomBytes(16, (randomError, randomBytes) => {
        if (randomError) {
          reject(randomError);
          return;
        }

        binding.gen_salt(minor, rounds, randomBytes, (bindingError, salt) => {
          if (bindingError) reject(bindingError);
          else resolve(salt);
        });
      });
    });

  const hash = (data, salt) =>
    new Promise((resolve, reject) => {
      binding.encrypt(data, salt, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });

  const compare = (data, encrypted) =>
    new Promise((resolve, reject) => {
      binding.compare(data, encrypted, (error, matches) => {
        if (error) reject(error);
        else resolve(matches);
      });
    });

  bcrypt = { genSalt, hash, compare };
}

export default bcrypt;
