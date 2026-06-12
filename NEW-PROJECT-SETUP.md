# New Project Setup — Instructions for Claude Code

Give this file to Claude Code in a new, empty project folder and say:
"Set up this project following NEW-PROJECT-SETUP.md. The project name is `<project-name>`."

This replicates the setup used for the YogaWithWiebke project: a plain static
website hosted on **Firebase Hosting**, with the code in a **GitHub repository
under JohannSteinhoff's account**, and (optionally) **automatic deployment on
every push** via GitHub Actions.

---

## 0. Rules for Claude (read first)

- **All git commits must be authored solely by Johann Steinhoff
  (`johannxsteinhoff@gmail.com`). Do NOT add a `Co-Authored-By: Claude` trailer
  or any other Claude/Anthropic attribution to commits, PRs, or the README.**
- Ask before doing anything that costs money or is hard to undo.
- Some commands are interactive logins (`firebase login`, `gh auth login`).
  Claude cannot complete browser logins itself — ask Johann to run those, or
  have him type `! <command>` in the Claude Code prompt to run them in-session.

## 1. Environment notes (Johann's machine)

- Windows 11 with **WSL2** (Claude Code runs inside WSL, files live under
  `/mnt/c/Users/johann/...`).
- Node.js + npm are installed on the **Windows** side. The Firebase CLI is
  installed via Windows npm at `C:\Users\johann\AppData\Roaming\npm\firebase`.
  From WSL, the plain `firebase` command may fail with `node: not found` —
  if so, use one of:
  - `firebase.cmd <args>` (calls the Windows install from WSL), or
  - `npx -y firebase-tools <args>` (if node is available in WSL), or
  - ask Johann to run the command in a Windows terminal (PowerShell).
- The `gh` (GitHub CLI) is **not installed** in WSL. Check with `which gh`;
  if missing, use the manual GitHub setup in step 4B, or install it first.

## 2. Project structure (no framework, no build step)

Create this layout. Everything that gets deployed lives in `public/`.

```
<project-folder>/
├── .firebaserc          # which Firebase project to deploy to
├── .gitignore
├── firebase.json        # Firebase Hosting config
├── README.md
└── public/              # the deployed site root
    ├── index.html
    ├── css/
    │   └── styles.css
    ├── js/
    │   └── main.js
    ├── assets/          # images etc.
    ├── robots.txt
    └── sitemap.xml
```

`.gitignore`:

```gitignore
# Firebase
.firebase/
firebase-debug.log
*-debug.log

# Dependencies
node_modules/

# OS / editor
.DS_Store
Thumbs.db
.vscode/

# Local preview screenshots (regenerated as needed)
preview-*.png
```

`firebase.json`:

```json
{
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "cleanUrls": true,
    "trailingSlash": false,
    "headers": [
      {
        "source": "**/*.@(jpg|jpeg|png|svg|webp|woff2)",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=604800" }
        ]
      }
    ]
  }
}
```

`.firebaserc` (replace with the new Firebase project ID from step 5):

```json
{
  "projects": {
    "default": "<firebase-project-id>"
  }
}
```

## 3. Git setup

```bash
git init -b main
git config user.name "Johann Steinhoff"
git config user.email "johannxsteinhoff@gmail.com"
git add -A
git commit -m "Initial site scaffold"
```

Reminder: plain commits, no co-author trailers.

## 4. GitHub repository (under JohannSteinhoff)

### 4A. If the `gh` CLI is available and logged in

```bash
gh auth status                 # if not logged in: ask Johann to run `gh auth login`
gh repo create JohannSteinhoff/<project-name> --public --source=. --remote=origin --push
```

(Use `--private` instead of `--public` if Johann prefers.)

### 4B. Manual fallback (what was done for YogaWithWiebke)

1. Ask Johann to create an empty repo at https://github.com/new
   (owner **JohannSteinhoff**, no README/license — the local repo provides those).
2. Then:

```bash
git remote add origin https://github.com/JohannSteinhoff/<project-name>.git
git push -u origin main
```

HTTPS pushes authenticate via the Windows Git Credential Manager that is
already set up; if the push asks for credentials, ask Johann to complete it.

## 5. Firebase Hosting

1. **Login (Johann must do this part if not already logged in):**

   ```bash
   firebase login          # opens a browser; have Johann run it via `! firebase login` if needed
   ```

2. **Create the Firebase project** (project IDs are global, so the preferred
   name may need a suffix):

   ```bash
   firebase projects:create <firebase-project-id> --display-name "<Project Name>"
   ```

   If CLI creation fails, ask Johann to create it at
   https://console.firebase.google.com instead (the free Spark plan is enough
   for static hosting).

3. **Point this folder at the project:** write `.firebaserc` as in step 2
   (or run `firebase use --add` and pick the project).

4. **First deploy:**

   ```bash
   firebase deploy --only hosting
   ```

   The site is then live at `https://<firebase-project-id>.web.app`.

Manual redeploys after changes are just `firebase deploy --only hosting`
(this is how YogaWithWiebke is published).

## 6. Automatic deploy on every push (optional but recommended)

To have Firebase redeploy automatically whenever `main` is pushed to GitHub:

```bash
firebase init hosting:github
```

This is interactive — Johann should run it (e.g. via `! firebase init hosting:github`).
When prompted:

- Repository: `JohannSteinhoff/<project-name>`
- Set up workflow to run a build before deploy: **No** (there is no build step)
- Auto-deploy on merge/push to `main`: **Yes**

It creates `.github/workflows/firebase-hosting-merge.yml` (and a PR-preview
workflow) and stores a Firebase service-account key as a GitHub repo secret.
Commit the workflow files and push. From then on, every push to `main`
publishes the site automatically — no manual `firebase deploy` needed.

## 7. Final checklist

- [ ] `public/index.html` opens correctly locally (`firebase serve` or just open the file)
- [ ] `git log` shows only Johann Steinhoff as author, no Claude co-author lines
- [ ] Repo visible at `github.com/JohannSteinhoff/<project-name>`
- [ ] Site live at `https://<firebase-project-id>.web.app`
- [ ] (If step 6 done) push a trivial change and confirm the GitHub Action deploys it
