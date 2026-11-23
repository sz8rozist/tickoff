import type { User } from './session';

/** A felhasználó nyilvános ábrázolása az API-ban (jelszó-hash és titkok nélkül). */
export function userDto(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    notifyEmail: u.notifyEmail,
    emailVerified: u.emailVerifiedAt !== null,
    digestFrequency: u.digestFrequency,
    twoFactorEnabled: u.totpEnabledAt !== null,
  };
}
