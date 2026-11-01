<p align="center">
  <img src="assets/badge.svg" width="120" alt="Uses AutoMod badge">
</p>

<h1 align="center">AutoMod Badge Bot</h1>

<p align="center">
  One slash command that checks whether your bot is in enough servers, then creates the AutoMod rules needed for the <strong>Uses AutoMod</strong> badge.
</p>

## About

Discord gives an application the **Uses AutoMod** badge once it has at least **100 AutoMod rules across all servers**. The badge can take up to about 24 hours to appear after the 100th rule exists ([Discord support article](https://support-dev.discord.com/hc/en-us/articles/13847462843543)).

Discord allows 6 keyword rules per server, so one server gives 6 rules and 100 rules need at least 17 servers.

`/badge` does the following:

1. Reads every server the bot is in (permission, existing rules, free keyword slots).
2. Calculates how many rules it can create and compares that with the target.
3. If there are not enough servers, it tells you how many to add and blocks the start.
4. Otherwise it creates the rules one at a time, with live progress.
5. At the end it recounts and shows the real total.

The rules are harmless. Each one blocks a random keyword that no real message contains, so members are not affected. Running the command again never duplicates rules.

With the defaults (6 rules per server, target 100, safety margin 10 percent):

| Servers | Rules | Result |
| --- | --- | --- |
| 2 | 12 | Not enough, add 15 or more servers |
| 16 | 96 | Not enough |
| 17 | 102 | Possible, little margin |
| 19 or more | 114 or more | Ready |

## Requirements

- Node.js 20 or newer
- A Discord application with a bot
- The **Manage Server** permission for the bot in every server where it should create rules

## Setup

```bash
git clone https://github.com/xgg-2/AutoMod-badge.git
cd AutoMod-badge
npm install
cp .env.example .env
```

Fill in `.env`:

```
DISCORD_TOKEN=your bot token
CLIENT_ID=your application id
```

Add the command once, then start the bot. This only adds `/badge` and never touches the other commands of the bot:

```bash
npm run deploy
npm start
```

Invite the bot to your servers with the **Manage Server** permission. When more servers are needed, the panel includes an invite button.

Never commit `.env` or share your token. If it leaks, reset it in the Developer Portal.

## Usage

Run `/badge`. Only the bot owner can use it, and the reply is visible only to you.

| Button | Action |
| --- | --- |
| Start | Creates the missing rules, with progress |
| Refresh | Reads all servers again |
| Cancel | Stops a running job after the current request |
| Remove rules | Deletes the rules the bot created (asks for confirmation) |
| Add bot to a server | Opens an invite link when more servers are needed |
| Delete command | Enabled only after the target is reached. Deletes `/badge` from the bot, other commands stay |

After the target is reached, keep the rules and wait for the badge. Removing them may remove the badge.

To remove the command without the panel, run `npm run undeploy`.

## Configuration

Set these in `.env`. Only the first one is required to run the bot.

| Variable | Default | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | required | Bot token |
| `CLIENT_ID` | required for `npm run deploy` | Application ID |
| `OWNER_IDS` | application owner | Comma separated user IDs allowed to run `/badge` |
| `RULES_PER_GUILD` | `6` | Rules per server, 1 to 6 |
| `TARGET_RULES` | `100` | Rules needed for the badge |
| `SAFETY_MARGIN_PERCENT` | `10` | Extra rules to aim for, in case a few fail |
| `CREATE_DELAY_MS` | `1200` | Pause between requests in milliseconds |
| `RULE_NAME_PREFIX` | `AutoMod Rule` | Rules are named `<prefix> <number>` |

Requests are sent one at a time and spread across servers to stay within Discord rate limits. A full run of about 114 rules takes two to three minutes.

## Troubleshooting

- **Servers skipped for missing permission:** give the bot Manage Server and press Refresh.
- **Servers skipped because slots are full:** another app already uses all 6 keyword rules there.
- **Start is disabled:** there are not enough servers yet. The panel shows how many to add.
- **Target reached but no badge:** wait up to about 24 hours and keep the rules enabled.

## Tests

```bash
npm test
```

## Responsible use

Use this only in servers you own or have permission to change. The rules appear in server settings and in the audit log under the reason "AutoMod badge setup".
