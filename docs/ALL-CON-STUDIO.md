# All Con Studio

All Con Studio is a local Windows desktop app for construction work orders and credit memos. It does not send email, and it does not use a server. Documents, the company logo, and attachments stay in a SQLite file on the computer.

This project is based on [Invoice Builder](https://github.com/piratuks/invoice-builder) by Evaldas L. The original source is MIT licensed. See `LICENSE` and `LICENSE-DISCLAIMER.md`. The Invoice Builder name and logo are not used here.

## Install on Windows 11

1. Download `All-Con-Studio-Setup-3.1.2.exe` from the GitHub Actions artifact described below, or from a release when one is published.
2. The installer is unsigned. Windows SmartScreen shows "Windows protected your PC".
3. Choose **More info**, then **Run anyway**.
4. The installer adds a Start menu entry named **All Con Studio**. It also offers an optional desktop shortcut with the same name.
5. Open All Con Studio. The first launch creates the database and a sample work order that uses placeholder contact details.

## Where data lives

The database file is:

`%APPDATA%\All Con Studio\all-con-studio.db`

On a typical Windows account that is:

`C:\Users\<you>\AppData\Roaming\All Con Studio\all-con-studio.db`

Settings shows the path the app actually opened. All Con Studio does not migrate old Invoice Builder database files. Opening one of those files is refused.

The company logo uploaded in Settings is stored in this database and reused on later documents. The sample logo shipped with a new database is only a starting point.

## Backup and restore

Backup copies the live database with SQLite's backup API into a folder you choose. It does not delete the original.

Restore asks you to confirm first. Before it replaces the current file, it writes a safety copy next to the database named `all-con-studio-safety-<timestamp>.db`. Creating a database never deletes a file that is already there.

## Create a work order

1. Choose **New Work Order**.
2. Pick the project group, then the vendor. You can add a vendor inline.
3. Confirm the suggested number, or type another unused number such as `WO8.25`.
4. Enter the vendor invoice number and the lines. Check the total. A manual total is a post-tax adjustment unless Settings says pre-tax. The adjustment is its own row and the line items stay as entered.
5. Choose **Download PDF**. The save dialog suggests `{number} - {project}.pdf`. Change that pattern in Settings.

The PDF is US Letter in Figtree. A work order is headed **Invoice** and numbered `WO<group>.<sequence>`, matching the layout used for project billing. Turn on **Amount paid on new documents** in Settings when the PDF should include Amount Paid and Balance Due. A credit memo is headed **Credit Memo** and the total is labeled **Credit Total**.

Credit memos use their own sequence, starting at `CM-1001`. The prefix, start, and padding are in Settings. A credit memo does not change the work order it refers to. The PDF labels the amount **Credit Total**.

Finalize locks the document. Later edits to the project or vendor do not change a finalized PDF. Duplicate makes a new draft with the next number.

## Windows installer from GitHub Actions

If a local unsigned installer is not attached to the pull request, download it from Actions:

1. Open the repository on GitHub and choose the **Actions** tab.
2. Open the **Windows installer** workflow.
3. Open the run for this branch or for a `v*` tag. You can also start one with **Run workflow**.
4. When the job is green, open **Artifacts** and download **All-Con-Studio-Setup**.
5. Unzip the artifact and run the `.exe` inside it, using the SmartScreen steps above.

The workflow file is `.github/workflows/windows-installer.yml`. It runs on `windows-latest`.
