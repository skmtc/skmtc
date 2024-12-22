import {
  authentication,
  AuthenticationProvider,
  AuthenticationProviderAuthenticationSessionsChangeEvent,
  AuthenticationSession,
  Disposable,
  EventEmitter,
  ExtensionContext,
  ProgressLocation,
  window,
  env,
  Uri,
  UriHandler,
} from 'vscode';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PromiseAdapter, promiseFromEvent } from '../utilities/auth';
import { v4 as uuid } from 'uuid';
import invariant from 'tiny-invariant';
import { SKMTC_ORIGIN, SKMTC_PUBLIC_ANON_KEY } from '../api/constants';

export const AUTH_TYPE = `skmtc`;
const AUTH_NAME = `Skmtc`;
const SESSIONS_SECRET_KEY = `${AUTH_TYPE}.sesssions`;

interface TokenInformation {
  accessToken: string;
  refreshToken: string;
}

class UriEventHandler extends EventEmitter<Uri> implements UriHandler {
  public handleUri(uri: Uri) {
    this.fire(uri);
  }
}

interface SkmtcAuthenticationSession extends AuthenticationSession {
  refreshToken: string;
}

export class SupabaseAuthenticationProvider implements AuthenticationProvider, Disposable {
  private _sessionChangeEmitter =
    new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();
  private _disposable: Disposable;
  private _codeExchangePromises = new Map<
    string,
    { promise: Promise<TokenInformation>; cancel: EventEmitter<void> }
  >();
  private supabase: SupabaseClient;
  private _uriHandler = new UriEventHandler();

  constructor(private readonly context: ExtensionContext) {
    this.supabase = createClient(SKMTC_ORIGIN, SKMTC_PUBLIC_ANON_KEY);

    this._disposable = Disposable.from(
      authentication.registerAuthenticationProvider(AUTH_TYPE, AUTH_NAME, this, {
        supportsMultipleAccounts: false,
      }),
      window.registerUriHandler(this._uriHandler)
    );

    this.context = context;
  }

  get onDidChangeSessions() {
    return this._sessionChangeEmitter.event;
  }

  /**
   * Get the existing sessions
   * @param scopes
   * @returns
   */
  public async getSessions(scopes?: string[]): Promise<AuthenticationSession[]> {
    try {
      const allSessions = await this.context.secrets.get(SESSIONS_SECRET_KEY);

      if (!allSessions) {
        return [];
      }

      // Get all required scopes
      const allScopes = this.getScopes(scopes || []) as string[];

      const sessions = JSON.parse(allSessions) as SkmtcAuthenticationSession[];

      if (!sessions) {
        return [];
      }

      if (!allScopes || !scopes) {
        return sessions;
      }

      const session = sessions.find((s) => scopes.every((scope) => s.scopes.includes(scope)));

      if (session && session.refreshToken) {
        const { accessToken, refreshToken } = await this.getAccessToken(
          session.accessToken,
          session.refreshToken
        );

        if (accessToken) {
          const updatedSession = Object.assign({}, session, {
            accessToken: accessToken,
            refreshToken: refreshToken,
            scopes: scopes,
          });
          return [updatedSession];
        } else {
          this.removeSession(session.id);
        }
      } else {
        console.log('NO REFRESH TOKEN');

        return [];
      }
    } catch (e) {
      console.error('EEEEE', e);
      // Nothing to do
    }

    return [];
  }

  /**
   * Retrieve a new access token by the refresh token
   * @param refreshToken
   * @param clientId
   * @returns
   */
  private async getAccessToken(accessToken: string, refreshToken: string) {
    const { data, error } = await this.supabase.auth.setSession({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      access_token: accessToken,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      refresh_token: refreshToken,
    });

    return { accessToken: data.session?.access_token, refreshToken: data.session?.refresh_token };
  }

  /**
   * Create a new auth session
   * @param scopes
   * @returns
   */
  public async createSession(scopes: string[]): Promise<AuthenticationSession> {
    console.log('CREATE SESSION');

    try {
      const { accessToken, refreshToken } = await this.login(scopes);

      if (!accessToken) {
        throw new Error(`Skmtc login failure`);
      }

      const userinfo = await this.getUserInfo(accessToken);

      const session: SkmtcAuthenticationSession = {
        id: uuid(),
        accessToken,
        refreshToken,
        account: {
          label: userinfo.username,
          id: userinfo.id,
        },
        scopes: this.getScopes(scopes),
      };

      await this.context.secrets.store(SESSIONS_SECRET_KEY, JSON.stringify([session]));

      this._sessionChangeEmitter.fire({ added: [session], removed: [], changed: [] });

      return session;
    } catch (e) {
      window.showErrorMessage(`Sign in failed: ${e}`);
      throw e;
    }
  }

  /**
   * Remove an existing session
   * @param sessionId
   */
  public async removeSession(sessionId: string): Promise<void> {
    console.log('REMOVE SESSION');

    const allSessions = await this.context.secrets.get(SESSIONS_SECRET_KEY);

    if (allSessions) {
      let sessions = JSON.parse(allSessions) as AuthenticationSession[];
      const sessionIdx = sessions.findIndex((s) => s.id === sessionId);
      const session = sessions[sessionIdx];
      sessions.splice(sessionIdx, 1);

      await this.context.secrets.store(SESSIONS_SECRET_KEY, JSON.stringify(sessions));

      if (session) {
        this._sessionChangeEmitter.fire({ added: [], removed: [session], changed: [] });
      }
    }
  }

  /**
   * Dispose the registered services
   */
  public async dispose() {
    this._disposable.dispose();
  }

  get redirectUri() {
    const publisher = this.context.extension.packageJSON.publisher;
    const name = this.context.extension.packageJSON.name;

    let callbackUrl = `${env.uriScheme}://${publisher}.${name}`;
    return callbackUrl;
  }

  private async getUserInfo(token: string) {
    const response = await this.supabase.auth.getUser(token);

    if (response.error) {
      throw new Error(response.error.message);
    }

    const id = response.data.user.id;
    const username = response.data.user.user_metadata.user_name;

    invariant(id && username, "Couldn't get user info");

    return {
      id,
      username,
    };
  }

  private async login(scopes: string[] = []): Promise<TokenInformation> {
    return await window.withProgress<TokenInformation>(
      {
        location: ProgressLocation.Notification,
        title: 'Signing in to Skmtc...',
        cancellable: true,
      },
      async (_, token) => {
        const oAuthRes = await this.supabase.auth.signInWithOAuth({
          provider: 'github',
          options: {
            redirectTo: this.redirectUri,
          },
        });

        const scopeString = scopes.join(' ');

        if (oAuthRes.error) {
          throw new Error(oAuthRes.error.message);
        }

        await env.openExternal(Uri.parse(oAuthRes.data.url));

        let codeExchangePromise = this._codeExchangePromises.get(scopeString);

        if (!codeExchangePromise) {
          codeExchangePromise = promiseFromEvent(this._uriHandler.event, this.handleUri(scopes));
          this._codeExchangePromises.set(scopeString, codeExchangePromise);
        }

        try {
          return await Promise.race([
            codeExchangePromise.promise,
            new Promise<string>((_, reject) => setTimeout(() => reject('Cancelled'), 60000)),
            promiseFromEvent<any, any>(token.onCancellationRequested, (_, __, reject) => {
              reject('User Cancelled');
            }).promise,
          ]);
        } finally {
          codeExchangePromise?.cancel.fire();
          this._codeExchangePromises.delete(scopeString);
        }
      }
    );
  }

  /**
   * Handle the redirect to VS Code (after sign in from Skmtc)
   * @param scopes
   * @returns
   */
  private handleUri: (scopes: readonly string[]) => PromiseAdapter<Uri, TokenInformation> =
    (scopes) => async (uri, resolve, reject) => {
      const searchParams = new URLSearchParams(uri.fragment);

      const accessToken = searchParams.get('access_token');
      invariant(accessToken, 'No access token');

      const refreshToken = searchParams.get('refresh_token');
      invariant(refreshToken, 'No refresh token');

      resolve({
        accessToken,
        refreshToken,
      });
    };

  /**
   * Get all required scopes
   * @param scopes
   */
  private getScopes(scopes: string[] = []): string[] {
    let modifiedScopes = [...scopes];

    if (!modifiedScopes.includes('offline_access')) {
      modifiedScopes.push('offline_access');
    }
    if (!modifiedScopes.includes('openid')) {
      modifiedScopes.push('openid');
    }
    if (!modifiedScopes.includes('profile')) {
      modifiedScopes.push('profile');
    }
    if (!modifiedScopes.includes('email')) {
      modifiedScopes.push('email');
    }

    return modifiedScopes.sort();
  }
}
