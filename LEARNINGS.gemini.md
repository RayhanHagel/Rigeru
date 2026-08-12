# Rigeru — Learnings Log

> Immutable, timestamped log of PRAR cycles. Append-only.

---

## 2026-08-10T16:35 — Spotify Downloader `[WinError 2]` Fix

### Context
User reported `[WinError 2] The system cannot find the file specified` when downloading a Spotify playlist via the web-downloaders/spotify page.

### Root Cause
`spotdl` was **not installed** in the venv. The utility `util_spotify_download.py` called `subprocess.run(["spotdl", ...])` which raised `FileNotFoundError` (WinError 2). The error was not caught, so the raw OS error bubbled up to the frontend.

### Actions Taken
1. **Diagnosed**: Verified `spotdl` missing from both venv and system PATH using `shutil.which()` and `pip show`.
2. **Installation issues**: 
   - First `uv pip install spotdl` failed because `websockets.pyd` was file-locked by the running backend process.
   - Killed backend Python processes (PIDs on port 8000).
   - Second attempt failed: previous partial install corrupted `websockets` dist-info (missing `METADATA` file).
   - Manually deleted `websockets*` from site-packages.
   - Third attempt succeeded — `spotdl==4.5.2` installed cleanly.
3. **Code hardened** in `utilities/util_spotify_download.py`:
   - Added `_get_spotdl_path()` — resolves executable from `sys.executable`'s parent (venv `Scripts/`) instead of relying on bare PATH lookup.
   - Added `FileNotFoundError` catch with a human-readable `RuntimeError`.
   - Added `os.makedirs(output_dir, exist_ok=True)` to auto-create output directory.

### Lessons
- **Always resolve venv executables via `sys.executable`'s directory**, not bare command names. The venv `Scripts/` dir is not necessarily on PATH when the backend process was started by `start.bat`.
- **`uv pip install` with a running server** will fail on Windows due to `.pyd` file locks. Must stop the backend before installing packages that touch loaded native modules.
- **Partial `uv` installs can corrupt dist-info**. If installation fails mid-way, manually clean the affected package directories before retrying.
- **Always catch `FileNotFoundError`** in `subprocess.run()` calls to external tools. Report which tool is missing.

---

## 2026-08-10T16:56 — Spotify `AudioProviderError` / YouTube Music No Results

### Context
User reported `YouTube Music returned no usable results for ... after 3 attempts` and `AudioProviderError: YT-DLP download error` when downloading a Spotify playlist.

### Root Cause
This is a **spotdl runtime behavior**, not a code bug. spotdl works by: (1) reading metadata from Spotify API, (2) searching YouTube Music for matching audio, (3) downloading via yt-dlp. Failures occur when:
- The track doesn't exist on YouTube Music (regional/niche content).
- YouTube is rate-limiting or blocking requests.
- yt-dlp is outdated relative to YouTube's anti-bot changes.

### Actions Taken
- Verified `yt-dlp==2026.7.4` is the latest PyPI version — not outdated.
- Explained the error to the user: some track failures are expected behavior, not bugs.

### Lessons
- **Not every error is a code bug.** External tool limitations (spotdl's dependency on YouTube Music availability) should be documented and communicated clearly, not "fixed" with code changes.
- For persistent issues, potential mitigations include: `--audio youtube` fallback provider, `--cookie-file` for authenticated YouTube access, or retries with delays.

---

## 2026-08-10T23:50 — Lucide React → Google Material Symbols Migration

### Context
All 117 frontend files used `lucide-react` icons, violating the `[UI Constraints]` rule requiring Google Material Design icons exclusively.

### Actions Taken
1. Enhanced `Icon` component in `src/lib/utils.tsx` with `size` prop for drop-in Lucide replacement.
2. Created a Node.js migration script (`migrate_icons.mjs`) with a complete mapping of ~160 Lucide icons to Material Symbols names.
3. Script migrated 115/117 files in one pass. Second PowerShell pass fixed 14 files with 22 unmapped icons.
4. Fixed corrupted `youtube-rss/page.tsx` — the script inserted an `import` inside a `finally` block due to regex matching on multi-line import removal; subsequent repair attempts via `replace_file_content` worsened the corruption due to mixed CRLF/LF line endings. Full file rewrite was required.
5. Uninstalled `lucide-react` from `package.json`. Updated `GEMINI.md` convention note.

### Lessons
- **Bulk migrations need line-ending-aware tooling.** The `replace_file_content` tool struggled with files containing mixed CRLF/LF line endings. When multiple edits fail, a full file overwrite is safer than incremental repairs.
- **Import insertion via regex is fragile.** The migration script's `lastIndexOf('import ')` heuristic failed when a file had `import` as part of a variable/comment deep inside the file. A proper AST-based approach (e.g., `jscodeshift`) would be more reliable for large-scale migrations.
- **Always verify after bulk scripts.** Running `npm run build` immediately after migration caught the misplaced import in one file — without it, the bug would have been invisible until runtime.
- **Material Symbols naming:** Use the exact names from fonts.google.com/icons. Key non-obvious mappings: `Loader2` → `progress_activity`, `ChevronDown` → `expand_more`, `X` → `close`, `AlertCircle` → `error`, `FileText` → `description`, `HardDrive` → `hard_drive`.

---

## 2026-08-11T19:20 — Batch Upload JSON.parse SyntaxError Fix

### Context
User reported `SyntaxError: JSON.parse: unexpected character at line 1 column 1` when using batch upload on image-vision/image-upscaler. Error occurred at "Tile 2/15" during processing.

### Root Cause
1. **Next.js dev proxy timeout** — default proxy timeout too short for long-running backend ops (image upscaling with 15+ tiles). Proxy returns non-JSON on timeout.
2. **Unsafe `res.json()` in error handler** — all 4 batch pages had bare `res.json()` in `!res.ok` path with no try/catch.

### Fix
1. `next.config.ts` — Added `experimental: { proxyTimeout: 300_000 }` (5 min).
2. All 4 batch pages — Wrapped error-path `res.json()` in try/catch falling back to `res.text()`.

### Lessons
- **Next.js proxy timeout is hidden culprit for long-running API calls.** Configure `proxyTimeout` for any backend >30s.
- **Always wrap error-path `res.json()` in try/catch.** Proxy timeouts return non-JSON bodies.
- **CRLF files require full-file overwrite when edits go wrong.** Incremental repair on corrupted CRLF files causes cascading damage.

---

## 2026-08-11T18:35 — React Tab State Isolation Fix

### Context
User reported that after switching from the 'Batch Folder' tab to the 'Single File' tab on the image-upscaler page, the page still processed the batch folder files instead of the single file. The user requested a way to 'clear' the file list.

### Root Cause
The `handleProcess` and `disabled` logic for the process button checked for the existence of batch files and folder paths *before* checking the single file hash, regardless of which tab (`inputMode`) was currently active. Furthermore, switching tabs did not clear the state from the previous tab.

### Actions Taken
1. Updated `handleProcess` to explicitly check the active `inputMode` before processing. If `inputMode === 'single'`, it ignores batch state, and vice versa.
2. Updated the process button's `disabled` state to conditionally evaluate readiness based on the active `inputMode`.
3. Modified the `ModernTabs` `setActiveTab` callback to immediately clear all uploaded file state (`clearState()`, `setBatchFiles([])`) when switching tabs, providing the explicit 'clear' functionality the user requested implicitly.

### Lessons
- **Tabbed interfaces must isolate processing state.** Never evaluate global state for an action if that state belongs to an inactive tab. Always gate processing logic with the active tab state (e.g., `if (inputMode === 'batch')`).
- **Clear state on tab switch.** To prevent hidden state from confusing the user, switching modes (like single vs. batch) should generally clear the inputs of the abandoned mode unless there's a specific reason to persist them.

---

## 2026-08-11T19:10 — Batch Output Gallery UI

### Context
User requested that the batch processing output for image-vision tools (like upscaler, background remover, and fisheye) feature a gallery-style image comparison viewer, rather than just showing a zoomable grid. They wanted to click an image from the grid to enter a detailed view with a slider (comparing original vs processed) and next/previous navigation buttons.

### Actions Taken
1. Added `selectedBatchIndex` state to `image-upscaler`, `background-remover`, and `fisheye`.
2. Updated the output render logic: When `processedUrls.length > 1`, clicking an image in the grid sets `selectedBatchIndex`.
3. If `selectedBatchIndex !== null`, the UI renders the `ImageCompareSlider` along with a top navigation bar containing "Back to Grid", "Prev", and "Next" buttons.
4. Added `setSelectedBatchIndex(null)` to the `clearState` functions so the gallery view closes when resetting the form or switching tabs.

### Lessons
- **Consistent Output Modalities:** If a tool provides a rich output visualization (like an image compare slider) for a single item, users expect that same visualization to be accessible when processing items in bulk. 
- **Progressive Disclosure:** For batch results, a grid view is good for high-level review, but clicking an item should escalate to the rich, single-item view with gallery navigation, rather than just a static fullscreen pop-up.

---

## 2026-08-11T19:20 — Global Layout Normalization (Full Width)

### Context
User noticed that `image-vision/object-detect` (Live Camera tab) was not utilizing the full width of the screen. They requested a global sweep to remove hardcoded `max-w-*` restrictions from page wrappers across the entire application to ensure every tool uses a full-width layout.

### Actions Taken
Identified and removed layout-constricting classes (like `max-w-4xl`, `max-w-lg`, `md:max-w-md`) from the main container `div`s in the following pages:
- `image-vision/object-detect`
- `data-science/llm-chat`
- `file-utils/hash-integrity`
- `documents-text/chart-maker`
- `productivity-life/randomizer`
- `productivity-life/qr-code`
- `productivity-life/korean-study`

### Lessons
- **Consistent Layout Language:** If an application's primary UI shell offers a wide, expansive canvas, individual tools shouldn't arbitrarily artificially constrain their own widths unless strictly necessary for readability (e.g., long-form text documents). A fluid, full-width approach `w-full` should be the default for interactive dashboard tools.

---

## 2026-08-11T19:30 — Object Detect Live Camera Fix

### Context
User reported that the Live Camera feed in `image-vision/object-detect` was not working.

### Actions Taken
1. Analyzed the frontend `toggleWebcam` logic and compared it to the backend FastAPI routers.
2. Discovered a mismatch: the frontend was passing `ai_fps` in the GET stream query string, but the backend expected `camera_index`.
3. Discovered that the frontend completely lacked a camera selection UI, and neglected to call the required `POST /object-detect/webcam-config` endpoint prior to initializing the GET stream.
4. Added state for `cameras` and `selectedCamera`, populated via the `GET /object-detect/cameras` endpoint on mount.
5. Added a `Select Camera` dropdown to the "Live Stream Setup" UI.
6. Rewrote `toggleWebcam` to be async: it now submits `camera_index` and `ai_fps` to the POST config endpoint first, then constructs the stream URL with the required `conf_thresh` and `camera_index` params.

### Lessons
- **Syncing Endpoints with Client Implementations:** When an API contract evolves (e.g., splitting a single endpoint into a POST config and GET stream), the frontend implementation must be thoroughly checked to ensure it satisfies all new required parameters (`camera_index`) and workflow order.
- **Async State Gaps & Empty `src` Attributes:** When a UI action asynchronously populates a media URL (like waiting for a config POST before setting a stream GET url), passing an empty string `""` to an `<img>` `src` attribute while waiting will trigger browser errors. Conditionally render the `<img>` element or provide a loading state instead.
- **Image Tags & Authenticated Streams:** Standard `<img>` tags making GET requests do not automatically include HTTP headers like `Authorization: Bearer <token>`. If a streamed image endpoint is protected, the token must be explicitly appended to the URL as a query parameter (e.g., `?token=...`) so the backend can validate it from the URI.
- **Async Resource Cleanup in Streaming Responses:** When serving a synchronous generator via FastAPI's `StreamingResponse` (using `run_in_threadpool`), client disconnections do not always gracefully cleanly shut down the background thread, especially if it involves C++ extensions (like OpenCV's `cap.release()`). Calling `.close()` on a generator from the main event loop while it was iterated in a worker thread can cause silent deadlocks or thread-affinity issues. The safest pattern is to pass a `threading.Event` down to the generator, poll it inside the generator's loop, and set it via `stop_event.set()` when `await request.is_disconnected()` is detected in the outer async wrapper. This allows the generator to exit cleanly and release its resources on the *same worker thread* that initialized them.

---

## 2026-08-11T20:11 — Vision Censor Configuration UI Consistency

### Context
The `vision-censor` page's configuration cards and output placeholder had different background and border styles compared to the primary `DirectUploadBox` component, creating visual inconsistency.

### Actions Taken
- Replaced inline color styles on the four configuration cards with utility classes `bg-[var(--theme-ui-bg)] backdrop-blur-md border-[var(--theme-ui-border)]` to match `DirectUploadBox`.
- Updated the output image/video placeholder from `bg-black/50 border-white/5` to the same UI theme classes.

### Lessons
- **UI Consistency:** Ensure all major layout containers and placeholders in a tool utilize the consistent theme variables (like `--theme-ui-bg` and `--theme-ui-border`) rather than hardcoding opacities or mixing inline styles, maintaining a unified dashboard look.

---

## 2026-08-12 — Image-Vision Suite UI Standardization
- **Perceive**: Required synchronizing the UI layouts, batch preview systems, and centering alignment across multiple image-vision modules based on `vision-censor` as a reference.
- **Reason**: Use multi_replace to systematically introduce `md:grid-cols-2` conditionally, add missing gradient tags for batch previews, and ensure preview placeholders use `absolute inset-0` for correct visual centering inside parent containers with sibling elements (e.g., hidden canvas). ModernTabs logic ported to rgb-shutter.
- **Act**: Edited `depth-estimation`, `face-blur`, `rgb-shutter`, `image-upscaler`, `background-remover`, `fisheye`, and `pinhole-photography`.
- **Refine**: Ensure careful closure of ternary operations inside JSX when dynamically replacing component blocks, to avoid React syntax errors.

---

## 2026-08-12 — Virtual Camera Broadcast Integration
- **Perceive**: Required adding OBS Virtual Camera broadcast functionality to `object-detect`, `face-blur`, and `depth-estimation` pages, referencing the existing implementation in `rgb-shutter`.
- **Reason**: Instead of duplicating WebSocket connection logic, I created a reusable `<VirtualCameraBroadcast>` React component that attaches to an `HTMLImageElement` via a `React.RefObject`. It uses an offscreen `<canvas>` with `requestAnimationFrame` on the main thread (acceptable overhead ~2-6ms per frame) to extract packed RGB byte arrays and stream them via WebSockets to the backend.
- **Act**: Drafted an implementation plan, extracted the component, added the necessary `useRef` hooks to the target pages, and successfully injected the component. Fixed TypeScript `RefObject` union type mismatches by adding `| null`.
- **Refine**: Abstracting complex WebSocket and Canvas APIs into reusable UI components (`VirtualCameraBroadcast`) drastically reduces boilerplate in the parent pages, keeping the UI code clean and maintainable. Main thread `getImageData` is highly efficient for standard resolutions (720p/480p) without needing complex Web Worker boundaries unless heavy pixel compositing is required (like in `rgb-shutter`).

---

## 2026-08-13 — Dashboard Shortcuts Routing Fix
- **Perceive**: The "Manage Shortcuts" button on the dashboard was non-functional due to an unused local state `isManageMode` instead of proper routing.
- **Reason**: The dashboard customization functionality is implemented in the `/home/sort` route. The button needed to be updated to navigate directly to this route via Next.js `useRouter`.
- **Act**: Removed the unused `isManageMode` state and updated the button's `onClick` handler to `router.push('/home/sort')`.
- **Refine**: Ensure dead code (like unused state hooks) is properly removed when features are refactored into distinct routes.

---

## 2026-08-13 — Dashboard Theme Variables Updates
- **Perceive**: The user requested that the `home/sort/page.tsx` widgets and the homepage "Manage Shortcuts" button use dynamic theme variables to follow the app's global UI theme.
- **Reason**: The components were hardcoded with fixed colors like `bg-zinc-900`, `border-white/5`. I needed to replace them with `bg-[var(--theme-ui-bg)]`, `border-[var(--theme-ui-border)]`, `text-[var(--theme-heading)]`, etc.
- **Act**: I applied the styling changes via `multi_replace_file_content`. Initially, a fuzzy matching error mangled `home/sort/page.tsx` by deleting JSX structure, requiring a user revert. Upon retrying, I used carefully scoped chunks (e.g., updating `SortableItem`, the "Add Card" wrapper, the "Staged Widgets" panel, and the dropdowns) which successfully preserved the logic. Finally, I re-applied the theme variables to `frontend/src/app/page.tsx`.
- **Refine**: When making bulk CSS class replacements on complex React components, always use highly specific replacement targets (exact start/end lines) rather than relying on tool fuzzy matching, as similar JSX patterns can cause the tool to delete crucial code boundaries.

---

## 2026-08-13 — Header Visibility & Duplicate Dividers Fix
- **Perceive**: The homepage header text was invisible in the "Light Minimal" theme, and there were two dividers under the header.
- **Reason**: The `Header` component (`src/components/ui/Header.tsx`) had hardcoded `text-white` and its own divider. My previous styling wrapper in `page.tsx` added a second divider.
- **Act**: I updated `Header.tsx` to use `var(--theme-heading)` and `var(--theme-text)` for visibility across all themes. I removed the redundant wrapper in `page.tsx` and passed the "Manage Shortcuts" button cleanly into the `actions` prop of the `Header` component.
- **Refine**: Always check the source code of shared UI components before wrapping them in additional styling containers, as they might already implement the layout rules (like dividers and flex containers) internally.

---

## 2026-08-13 — Builder Input Fields Theme Support
- **Perceive**: The text inputs and selects in the `home/sort` widget builder were still hardcoded to `bg-zinc-950` and `text-white`, rendering them unreadable in the Light Minimal theme.
- **Reason**: The initial theme sweep missed these deeply nested form controls.
- **Act**: Updated all `input` and `select` elements inside the builder to use standard dynamic inline styles (`backgroundColor: "var(--theme-bg)"`, `color: "var(--theme-text)"`) along with dynamic border focus overrides, matching the primary guideline.
- **Refine**: When doing theme conversions, use regex searches (like `bg-zinc-` or `text-white`) to ensure all hardcoded strings inside a file are caught, rather than just relying on visual spot checks.

---

## 2026-08-13 — ModernTabs & Image-Vision Headers Theme Support
- **Perceive**: The user requested that the `ModernTabs` component and the header dividers across all `image-vision` pages be updated to respect the dynamic application theme.
- **Reason**: The `ModernTabs` component was hardcoded with `bg-zinc-900/80` and `text-zinc-400`. The headers in `image-vision` used `border-primary/30` which clashed with the universal UI border standard `var(--theme-ui-border)`.
- **Act**: Updated `ModernTabs.tsx` to use `var(--theme-ui-bg)`, `var(--theme-ui-border)`, `var(--theme-bg)`, and `var(--theme-text)`. Used a bulk concurrent replace script to quickly swap the divider color in all 8 `image-vision` pages.
- **Refine**: Systematically utilizing `grep_search` and concurrent `replace_file_content` is a highly efficient way to do sweep operations across an entire directory of files.

---

## 2026-08-13 — Image-Vision Widgets Theme Standardization
- **Perceive**: The user asked to verify if widgets inside `image-vision` followed the theme color palette. Many did not.
- **Reason**: Specific elements like thumbnail galleries, toggle switches, and video wrappers were using hardcoded tailwind classes (`bg-zinc-950`, `bg-black`, `bg-zinc-700`).
- **Act**: Drafted an implementation plan to systematically replace all un-themed containers with `bg-[var(--theme-ui-bg)]` and `border-[var(--theme-ui-border)]` variables. Executed the plan using concurrent regex replacements after user approval.
- **Refine**: When replacing generic interactive components like toggle switches, be careful with pseudo-elements (like `after:bg-white`) as they usually don't need theme tracking, but their unchecked container (`bg-zinc-700`) does.

---

## 2026-08-13 — BatchFolderSelector Component Extraction
- **Perceive**: The user noticed a complex block of layout code ("No folder selected") duplicated across multiple tool pages.
- **Reason**: Copy-pasting chunks of UI code inside individual pages creates a maintenance burden, especially when updating themes. 
- **Act**: Abstracted the duplicated layout block into a single reusable `<BatchFolderSelector>` component inside `src/components/ui/`. Replaced the ~20 lines of hardcoded JSX in 5 different tool pages (`vision-censor`, `pinhole-photography`, `image-upscaler`, `fisheye`, `background-remover`) with the new component.
- **Refine**: Proactively identifying copy-pasted layout blocks during refactoring sweeps and consolidating them into reusable components drastically simplifies future maintenance and theme synchronization.

---

## 2026-08-13 — DirectUploadBox Icon Alignment
- **Perceive**: The user noticed that the icon inside `DirectUploadBox` and `DirectMultiUploadBox` was not perfectly aligned within its background box.
- **Reason**: The `Icon` component uses Material Symbols text spans. Applying strict `w-8 h-8` tailwind classes to the text span itself causes padding/centering mismatches within the wrapper div.
- **Act**: Removed the strict width/height classes from the `<Icon>`, bumped the explicit `size` prop to `32`, and added `flex items-center justify-center` to the wrapper div.
- **Refine**: When centering text-based icon fonts inside a container, use flexbox centering on the container rather than explicit width/height properties on the icon itself.