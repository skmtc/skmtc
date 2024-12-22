import { authentication } from 'vscode';
import { AUTH_TYPE } from './supabaseAuthenticationProviderRemote';

type GetSessionArgs = {
  createIfNone: boolean;
};

export const getSession = async ({ createIfNone }: GetSessionArgs) => {
  const session = await authentication.getSession(AUTH_TYPE, [], { createIfNone });

  return session;
};
