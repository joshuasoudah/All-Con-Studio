# All Con Studio

All Con Studio is an offline Windows desktop app for construction **work orders** and **credit memos**. It replaces a hosted invoicing workflow with a local SQLite database, a split editor, and a letter-size PDF. There is no account, no server mode, and no email sending.

Install steps, the database path, backup, and the five-step work order flow are in [docs/ALL-CON-STUDIO.md](docs/ALL-CON-STUDIO.md).

All Con Studio is based on [Invoice Builder](https://github.com/piratuks/invoice-builder) by Evaldas L. That project is the source of the Electron, React, and SQLite application this fork adapts. The original work is covered by the MIT license in [LICENSE](LICENSE). The Invoice Builder name and logo are trademarks of Evaldas L. and are not used as the identity of this app. See [LICENSE-DISCLAIMER.md](LICENSE-DISCLAIMER.md).

## What it does

- Work orders numbered `WO<group>.<sequence>`, with a separate credit-memo sequence that starts at `CM-1001`
- Project groups and vendors. Choosing one copies its details into the draft. Saving the draft does not change the template.
- A split editor with the form on the left and a live PDF preview on the right
- Integer-cent totals, a visible post-tax adjustment when you override the total, and an optional pre-tax mode
- Finalize a document so later template edits do not change it
- SQLite backup and a restore that confirms first and writes a safety copy
- A new database at `%APPDATA%\All Con Studio\all-con-studio.db`. Old Invoice Builder files are not migrated.

## Quick start

Windows install, SmartScreen, backup, and the work-order flow: [docs/ALL-CON-STUDIO.md](docs/ALL-CON-STUDIO.md).

The unsigned installer is built on GitHub Actions (`Windows installer` workflow) and downloaded from that run's artifacts.

## Development

The app is Electron, React, and TypeScript, with SQLite through `sqlite3`. From the repository root, with Node 24:

```bash
npm install
npm test
npm run build:desktop:all
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. The original Invoice Builder documentation remains at [piratuks.github.io/invoice-builder](https://piratuks.github.io/invoice-builder/) for the code this fork started from.

## License

All Con Studio keeps the [MIT License](LICENSE) from Invoice Builder. Copyright 2025 Evaldas L. The MIT grant covers the source code. It does not grant rights to the Invoice Builder name or logo.

## Support

Invoice Builder, the project this app is based on, is maintained by Evaldas L. Support for that original project is at [GitHub Sponsors](https://github.com/sponsors/piratuks) or [Buy Me a Coffee](https://www.buymeacoffee.com/evaldizi).
