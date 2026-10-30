# skmtc feedback

> Send a problem or a feature request to the Skmtc team. skmtc-hub
> files it as a GitHub issue, and the command prints the feedback id and
> the issue URL.

## Synopsis

```
skmtc feedback --kind problem|feature_request --summary <text> --details <text> [--operation <name>] [--resource <ref>] [--request-id <id>] [--env <env>] [--token <pat>] [--json] [--no-input]
```

The command calls `POST /v1/feedback`. The hub accepts any token that
it accepts for other requests: a token needs no scope. The text goes
into a public GitHub issue. Do not put tokens, keys or personal data in
it.

## Options

| Option              | Meaning                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `--kind <kind>`     | `problem` or `feature_request`. Required.                                                   |
| `--summary <text>`  | One line, 1 to 200 characters. Required.                                                    |
| `--details <text>`  | 1 to 8000 characters. Required. The command does not read it from stdin.                    |
| `--operation <name>`| The command or operation that the feedback is about, for example `generate`. At most 200 characters. |
| `--resource <ref>`  | The resource that the feedback is about, for example `@acme/pets`. At most 200 characters.  |
| `--request-id <id>` | The request id from a failed hub command. At most 200 characters.                           |
| `--token <pat>`     | A personal access token. Without it, the command uses `$SKMTC_HUB_TOKEN`, then the token from `skmtc login`. |
| `--env <env>`       | As for [`pull`](pull.md).                                                                   |

The command also sends `clientName` (`skmtc-cli`) and `clientVersion`
(the CLI version) as context.

The command exits `2` before it sends a request when:

- you give no `--kind`, `--summary` or `--details`;
- the summary has more than one line, or a value is too long;
- there is no token.

## Output

```
Feedback sent: fb_01J…
  https://github.com/skmtc/skmtc-hub/issues/123
```

## JSON output

```json
{ "type": "sent", "id": "fb_01J…", "issueUrl": "https://github.com/skmtc/skmtc-hub/issues/123" }
```

A failure exits `1`:

```jsonc
{
  "type": "failed",
  "code": "rate-limited",
  "status": 429,
  "message": "Feedback limit reached … Try again in 90 minutes.",
  "retryAfterSeconds": 5400
}
```

| `code`         | Cause                                                                                   |
| -------------- | --------------------------------------------------------------------------------------- |
| `bad-request`  | 400: the hub refused a value. `details` names it.                                       |
| `unauthorized` | 401: the hub refused the token. The message tells you to run `skmtc login`.             |
| `rate-limited` | 429: too much feedback. `retryAfterSeconds` and the message give the wait, when the hub sends it. |
| `bad-gateway`  | 502: GitHub did not confirm the issue, and the hub stored nothing. Try again later.     |
| `unavailable`  | 503: this hub environment cannot take feedback.                                         |
| `network`      | The command cannot reach the hub, or the hub did not answer in 30 seconds. The hub can have filed the issue: look before you send it again. |
| `hub-error`    | Another answer from the hub.                                                            |

## See also

- [`whoami`](whoami.md): the account and environment that the command uses
- [`login`](login.md): sign in, so that the command has a token
