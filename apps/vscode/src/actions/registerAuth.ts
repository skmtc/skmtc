import { authentication, commands } from 'vscode';
import { getSession } from '../auth/getSession';
import { SupabaseAuthenticationProvider } from '../auth/supabaseAuthenticationProviderRemote';

export const registerAuth = (authProvider: SupabaseAuthenticationProvider) => {
  const authSignInDisposable = commands.registerCommand('skmtc-vscode.signIn', async () => {
    return await getSession({ createIfNone: true });
  });

  const authSignOutDisposable = commands.registerCommand('skmtc-vscode.signOut', async () => {
    const session = await getSession({ createIfNone: false });

    if (!session) {
      return;
    }

    return await authProvider.removeSession(session.id);
  });

  const authChangeDisposable = authentication.onDidChangeSessions(async (event) => {
    await getSession({ createIfNone: false });
  });

  return [authSignInDisposable, authSignOutDisposable, authChangeDisposable];
};
