import { useEffect, useState } from 'react';
import { Alert, Button, Center, Loader, Stack } from '@mantine/core';
import { api, ApiError, getToken, type User } from './api';
import { ApiKeysModal } from './ApiKeysModal';
import { TwoFactorModal } from './TwoFactorModal';
import { AuthForm } from './AuthForm';
import { AuthShell } from './AuthShell';
import { DeleteAccountModal } from './DeleteAccountModal';
import { ProjectsPage } from './ProjectsPage';
import { CustomersPage } from './CustomersPage';
import { DashboardProvider } from './DashboardContext';
import { FeedbackPage } from './FeedbackPage';
import { PATH_CUSTOMERS, PATH_FEEDBACK, PATH_PROJECTS, PATH_SETTINGS, Shell } from './Shell';
import { SettingsPage } from './SettingsPage';
import { Landing } from './Landing';
import { PATH_LOGIN, PATH_REGISTER, usePath } from './route';
import { ResetPasswordPage } from './ResetPasswordPage';
import { t, useLang } from './i18n';

const RESET_PARAM = 'reset-token';
const VERIFY_PARAM = 'verify-token';

/** A jelszó-visszaállító linkből érkező token (tiszta olvasás: a címsorból törlés külön, effectben történik). */
function readResetToken(): string | null {
  return new URLSearchParams(window.location.search).get(RESET_PARAM);
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(readResetToken);
  // Az e-mail-megerősítő linkből érkező token és az eredménye
  const [verifyToken] = useState<string | null>(() => new URLSearchParams(window.location.search).get(VERIFY_PARAM));
  const [verifyResult, setVerifyResult] = useState<'ok' | 'fail' | null>(null);
  const [resent, setResent] = useState(false);
  const [path, navigate] = usePath();
  const { lang, setLang } = useLang();
  // Ha van mentett token, először megnézzük, érvényes-e.
  const [loading, setLoading] = useState<boolean>(() => getToken() !== null);

  // A token a címsorban maradna (előzmények, Referer, megosztott képernyő): azonnal eltávolítjuk, a state-ben megvan.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has(RESET_PARAM) || url.searchParams.has(VERIFY_PARAM)) {
      url.searchParams.delete(RESET_PARAM);
      url.searchParams.delete(VERIFY_PARAM);
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  }, []);

  // Megerősítő link: beváltjuk, és ha be vagyunk jelentkezve, frissítjük a felhasználót (a függő meghívók ilyenkor lépnek életbe)
  useEffect(() => {
    if (!verifyToken) return;
    api
      .verifyEmail(verifyToken)
      .then(() => {
        setVerifyResult('ok');
        if (getToken()) api.me().then(setUser).catch(() => undefined);
        else navigate(PATH_LOGIN, true);
      })
      .catch(() => {
        setVerifyResult('fail');
        if (!getToken()) navigate(PATH_LOGIN, true);
      });
  }, [verifyToken, navigate]);

  // A fiók nyelve a bejelentkezés után érvényesül (a felület ezen a nyelven nyílik meg minden eszközön)
  useEffect(() => {
    if (user && user.lang !== lang) setLang(user.lang);
  }, [user, lang, setLang]);

  // Bejelentkezve a belépő és regisztrációs címeknek nincs értelme: a dashboardra irányítunk
  useEffect(() => {
    if (user && (path === PATH_LOGIN || path === PATH_REGISTER)) navigate('/', true);
  }, [user, path, navigate]);

  async function resendVerification() {
    try {
      await api.resendVerification();
      setResent(true);
    } catch {
      /* a következő próbálkozásnál újra lehet kérni */
    }
  }

  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(setUser)
      .catch((e) => {
        // Csak akkor dobjuk el a tokent, ha a szerver tényleg elutasította (lejárt/érvénytelen).
        if (e instanceof ApiError && e.status === 401) api.logout();
      })
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    api.logout();
    setUser(null);
  }

  // A visszaállító linkről érkező felhasználó (be van-e jelentkezve vagy sem) először az új jelszót adja meg
  if (resetToken) {
    return (
      <AuthShell onHome={() => setResetToken(null)}>
        <ResetPasswordPage
          token={resetToken}
          onDone={() => {
            // A jelszócsere után a régi bejelentkezések érvénytelenek: tiszta lappal indulunk
            api.logout();
            setUser(null);
            setResetToken(null);
          }}
        />
      </AuthShell>
    );
  }

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  // Bejelentkezés előtt a  a bemutató oldal, a belépés és a regisztráció külön címen van
  if (!user && path !== PATH_LOGIN && path !== PATH_REGISTER) {
    return <Landing navigate={navigate} />;
  }

  if (!user) {
    return (
      <AuthShell onHome={() => navigate('/')}>
        {verifyResult === 'ok' && (
          <Alert color="green" mb="md" role="status">
            {t('Az e-mail-címed megerősítve. Most már beléphetsz.')}</Alert>
        )}
        {verifyResult === 'fail' && (
          <Alert color="red" mb="md" role="alert">
            {t('A megerősítő link érvénytelen vagy lejárt. Belépés után kérhetsz újat.')}</Alert>
        )}
        <AuthForm key={path} initialMode={path === PATH_REGISTER ? 'register' : 'login'} onAuth={setUser} onNavigate={navigate} />
      </AuthShell>
    );
  }

  const page =
    path === PATH_FEEDBACK ? (
      <FeedbackPage currentUserId={user.id} onGoProjects={() => navigate(PATH_PROJECTS)} />
    ) : path === PATH_CUSTOMERS ? (
      <CustomersPage />
    ) : path === PATH_SETTINGS ? (
      <SettingsPage
        user={user}
        onUser={setUser}
        onTwoFactor={() => setTwoFactorOpen(true)}
        onApiKeys={() => setApiKeysOpen(true)}
        onDeleteAccount={() => setDeleteAccountOpen(true)}
      />
    ) : (
      <ProjectsPage onOpenProject={() => navigate(PATH_FEEDBACK)} />
    );

  return (
    <DashboardProvider>
      <Shell user={user} path={path} navigate={navigate} onLogout={logout}>
        <Stack gap="md">
          {verifyResult === 'ok' && (
            <Alert color="green" role="status" withCloseButton onClose={() => setVerifyResult(null)}>
              {t('Az e-mail-címed megerősítve.')}</Alert>
          )}
          {verifyResult === 'fail' && (
            <Alert color="red" role="alert" withCloseButton onClose={() => setVerifyResult(null)}>
              {t('A megerősítő link érvénytelen vagy lejárt. Kérj újat lent.')}</Alert>
          )}
          {!user.emailVerified && (
            <Alert color="yellow" title={t('Erősítsd meg az e-mail-címed')}>
              {t('Küldtünk egy levelet a(z)')}{' '}{user.email} {t('címre. A megerősítésig a hozzád érkező projektmeghívók nem lépnek életbe.')}{' '}
              {resent ? (
                t('Új levelet küldtünk.')
              ) : (
                <Button size="compact-xs" variant="light" onClick={() => void resendVerification()}>
                  {t('Küldd újra')}</Button>
              )}
            </Alert>
          )}
          {page}
        </Stack>
      </Shell>
      <TwoFactorModal user={user} opened={twoFactorOpen} onClose={() => setTwoFactorOpen(false)} onChanged={setUser} />
      <ApiKeysModal opened={apiKeysOpen} onClose={() => setApiKeysOpen(false)} />
      <DeleteAccountModal
        opened={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
        onDeleted={() => {
          setDeleteAccountOpen(false);
          logout();
        }}
      />
    </DashboardProvider>
  );
}
