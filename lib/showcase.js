/**
 * Delivery showcase: which files a finished team actually produced, and how
 * the browser can display them in place of "open this file and run it".
 *
 * The product rule this module serves: a delivery is shown to the user inside
 * 法脉·藏经阁, never handed over as a command the user has to run. The module is
 * therefore split into pure discovery (a deterministic list of displayable
 * artifacts) and one containment-checked resolver; the plugin's Web routes
 * stream the bytes. Nothing here renders, executes, or trusts a request path.
 *
 * Safety rules:
 *  · every read is a workspace-relative path resolved with realpath and
 *    rejected when it leaves the workspace, so a symlink cannot become a read
 *    of host files;
 *  · hidden files ('.env', '.git', …) and package/state directories never enter
 *    the list, so a showcase cannot advertise secrets or installed packages;
 *  · serving is limited to files under the team's product root or to artifacts
 *    a task actually declared, and one response is capped at
 *    {@link MAX_SHOWCASE_FILE_BYTES}.
 *
 * @module dsh-super-agent/showcase
 */
import { lstatSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { extname, isAbsolute, join, relative, sep } from 'node:path';
/** Largest single artifact the showcase will serve. */
export const MAX_SHOWCASE_FILE_BYTES = 32 * 1024 * 1024;
/** Hard cap on discovered files so a huge product tree stays readable. */
const MAX_SHOWCASE_FILES = 300;
/** Deepest directory level the file walk visits. */
const MAX_SCAN_DEPTH = 8;
/** Directory segments that are never artifacts (secrets, state, packages). */
const SKIPPED_SEGMENTS = new Set([
    '.git', '.agent-teams', '.dsh', '.pixel-team', '.cache', '.vite', '.next',
    'node_modules', 'target', 'coverage', '__pycache__',
]);
const KIND_ORDER = {
    html: 0, image: 1, markdown: 2, pdf: 3, text: 4, video: 5, audio: 6, code: 7, other: 8,
};
const EXTENSION_KIND = {
    '.html': 'html', '.htm': 'html',
    '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image', '.webp': 'image',
    '.svg': 'image', '.avif': 'image', '.bmp': 'image', '.ico': 'image',
    '.md': 'markdown', '.markdown': 'markdown',
    '.pdf': 'pdf',
    '.txt': 'text', '.log': 'text', '.csv': 'text', '.tsv': 'text', '.json': 'text',
    '.json5': 'text', '.yaml': 'text', '.yml': 'text', '.toml': 'text', '.ini': 'text',
    '.xml': 'text', '.srt': 'text', '.ass': 'text',
    '.js': 'code', '.mjs': 'code', '.cjs': 'code', '.jsx': 'code', '.ts': 'code',
    '.tsx': 'code', '.css': 'code', '.scss': 'code', '.less': 'code', '.vue': 'code',
    '.svelte': 'code', '.py': 'code', '.rs': 'code', '.go': 'code', '.java': 'code',
    '.c': 'code', '.h': 'code', '.cpp': 'code', '.hpp': 'code', '.cs': 'code',
    '.rb': 'code', '.php': 'code', '.sh': 'code', '.ps1': 'code', '.bat': 'code',
    '.sql': 'code', '.glsl': 'code', '.wgsl': 'code',
    '.mp4': 'video', '.webm': 'video', '.mov': 'video',
    '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio', '.flac': 'audio', '.m4a': 'audio',
};
const MEDIA_TYPES = {
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.json5': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8', '.markdown': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8', '.log': 'text/plain; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8', '.tsv': 'text/tab-separated-values; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.webp': 'image/webp', '.avif': 'image/avif', '.bmp': 'image/bmp', '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.m4a': 'audio/mp4',
    '.wasm': 'application/wasm',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
    '.yaml': 'text/plain; charset=utf-8', '.yml': 'text/plain; charset=utf-8', '.toml': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
};
/** Classify a path for preview purposes. */
export function showcaseKindOf(path) {
    return EXTENSION_KIND[extname(path).toLowerCase()] ?? 'other';
}
/**
 * Normalize one workspace-relative POSIX path. Absolute paths, drive letters,
 * empty segments and '..' are rejected (never clamped, so a caller cannot turn
 * a rejected path into a broader one).
 */
export function normalizeShowcasePath(input) {
    if (typeof input !== 'string')
        return undefined;
    const posix = input.trim().replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
    if (posix === '')
        return undefined;
    if (posix.startsWith('/') || /^[A-Za-z]:/.test(posix))
        return undefined;
    const segments = posix.split('/');
    if (segments.some(segment => segment === '' || segment === '.' || segment === '..'))
        return undefined;
    return posix;
}
function isSkipped(path) {
    return path.split('/').some(segment => segment === '' || segment.startsWith('.') || SKIPPED_SEGMENTS.has(segment));
}
function realRootOf(workspace) {
    try {
        return realpathSync(workspace);
    }
    catch {
        return undefined;
    }
}
function insideRoot(root, absolute) {
    const rel = relative(root, absolute);
    return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel));
}
function resolvesInside(root, absolute) {
    try {
        return insideRoot(root, realpathSync(absolute));
    }
    catch {
        return undefined;
    }
}
/**
 * Stat one workspace-relative file and prove it stays inside the workspace
 * even when the path (or a parent) is a symlink.
 */
function statWorkspaceFile(workspace, root, path) {
    if (root === undefined)
        return undefined;
    const absolute = join(workspace, path);
    try {
        const link = lstatSync(absolute);
        const target = link.isSymbolicLink() ? statSync(absolute) : link;
        if (!target.isFile())
            return undefined;
        if (resolvesInside(root, absolute) !== true)
            return undefined;
        return { size: target.size, mtimeMs: target.mtimeMs };
    }
    catch {
        return undefined;
    }
}
function walkProductRoot(workspace, prefix, found, state) {
    const queue = [{ rel: prefix, depth: 0 }];
    while (queue.length > 0) {
        const current = queue.shift();
        if (current.depth > MAX_SCAN_DEPTH) {
            state.truncated = true;
            continue;
        }
        let entries;
        try {
            entries = readdirSync(join(workspace, current.rel), { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of [...entries].sort((left, right) => left.name.localeCompare(right.name))) {
            if (entry.name.startsWith('.'))
                continue;
            const rel = current.rel === '' ? entry.name : current.rel + '/' + entry.name;
            if (isSkipped(rel))
                continue;
            if (found.length >= MAX_SHOWCASE_FILES) {
                state.truncated = true;
                return;
            }
            // Traversal never follows symlinked directories: they can leave the
            // workspace or form a cycle.
            if (entry.isSymbolicLink())
                continue;
            if (entry.isDirectory()) {
                queue.push({ rel, depth: current.depth + 1 });
                continue;
            }
            if (!entry.isFile())
                continue;
            found.push(rel);
        }
    }
}
function declaredPaths(team) {
    const declared = new Set();
    for (const task of team.tasks) {
        for (const value of task.deliverables ?? []) {
            const path = normalizeShowcasePath(value);
            if (path !== undefined && !isSkipped(path))
                declared.add(path);
        }
        if (task.status === 'completed') {
            for (const value of task.changedPaths ?? []) {
                const path = normalizeShowcasePath(value);
                if (path !== undefined && !isSkipped(path))
                    declared.add(path);
            }
        }
        for (const artifact of task.reviewedArtifacts ?? []) {
            const path = normalizeShowcasePath(artifact.path);
            if (path !== undefined && !isSkipped(path))
                declared.add(path);
        }
    }
    return [...declared];
}
function pickEntry(paths, projectRoot) {
    const html = paths.filter(path => showcaseKindOf(path) === 'html');
    if (html.length === 0)
        return undefined;
    const preferred = projectRoot === undefined
        ? ['dist/index.html', 'index.html', 'public/index.html']
        : [projectRoot + '/dist/index.html', projectRoot + '/index.html', projectRoot + '/public/index.html'];
    for (const candidate of preferred) {
        if (html.includes(candidate))
            return candidate;
    }
    return [...html].sort((left, right) => left.split('/').length - right.split('/').length || left.localeCompare(right))[0];
}
/**
 * Build the delivery showcase of one team.
 *
 * Discovery merges two sources: artifacts a task declared (the work order's
 * own claim) and files actually present under the product root (what the
 * delivery would contain even if a worker forgot to declare a path). A file is
 * listed once, sorted entry-first so the panel's default preview is the page a
 * user would otherwise have to open and run manually.
 */
function actionsFor(files, projectRoot) {
    const actions = [];
    for (const file of files) {
        const ext = extname(file.path).toLowerCase();
        const cwd = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : (projectRoot ?? '.');
        if (ext === '.html') {
            actions.push({ id: 'preview:' + file.path, path: file.path, kind: 'preview' });
        }
        else if (ext === '.py') {
            actions.push({ id: 'python:' + file.path, path: file.path, kind: 'process', command: 'python', args: [file.path], cwd });
        }
        else if (ext === '.exe') {
            actions.push({ id: 'exe:' + file.path, path: file.path, kind: 'process', command: file.path, cwd });
        }
        else if (ext === '.bat' || ext === '.cmd') {
            actions.push({ id: 'batch:' + file.path, path: file.path, kind: 'process', command: 'cmd.exe', args: ['/c', file.path], cwd });
        }
        else if (ext === '.rs' || file.path.split('/').pop() === 'Cargo.toml') {
            actions.push({ id: 'rust:' + file.path, path: file.path, kind: 'process', command: 'cargo', args: ['run'], cwd: projectRoot ?? cwd });
        }
    }
    return actions;
}
export function buildShowcase(workspace, team) {
    const root = realRootOf(workspace);
    const rawRoot = team.planProjectRoot === undefined ? undefined : normalizeShowcasePath(team.planProjectRoot);
    const projectRoot = rawRoot === undefined || root === undefined || team.planProjectRoot === undefined
        ? undefined
        : (resolvesInside(root, join(workspace, rawRoot)) === true ? rawRoot : undefined);
    const found = new Set();
    const declared = new Set();
    for (const path of declaredPaths(team)) {
        if (statWorkspaceFile(workspace, root, path) === undefined)
            continue;
        declared.add(path);
        found.add(path);
    }
    const state = { truncated: false };
    if (projectRoot !== undefined && root !== undefined && statWorkspaceFileExists(workspace, root, projectRoot)) {
        const scanned = [];
        walkProductRoot(workspace, projectRoot, scanned, state);
        for (const path of scanned)
            found.add(path);
    }
    const entry = pickEntry([...found], projectRoot);
    const files = [];
    for (const path of found) {
        const stat = statWorkspaceFile(workspace, root, path);
        if (stat === undefined)
            continue;
        files.push({
            path,
            kind: showcaseKindOf(path),
            size: stat.size,
            mtimeMs: stat.mtimeMs,
            declared: declared.has(path),
            entry: path === entry,
        });
    }
    files.sort((left, right) => {
        if (left.entry !== right.entry)
            return left.entry ? -1 : 1;
        const kind = KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
        if (kind !== 0)
            return kind;
        const depth = left.path.split('/').length - right.path.split('/').length;
        if (depth !== 0)
            return depth;
        return left.path.localeCompare(right.path);
    });
    return {
        teamId: team.id,
        teamName: team.name,
        ...projectRoot === undefined ? {} : { projectRoot },
        ...entry === undefined ? {} : { entry },
        files,
        actions: actionsFor(files, projectRoot),
        truncated: state.truncated,
        generatedAt: Date.now(),
    };
}
function statWorkspaceFileExists(workspace, root, path) {
    try {
        const absolute = join(workspace, path);
        const stat = statSync(absolute);
        if (!stat.isDirectory())
            return false;
        return resolvesInside(root, absolute) === true;
    }
    catch {
        return false;
    }
}
/** Media type for one artifact path; unknown extensions stream as octet-stream. */
export function showcaseMediaType(path) {
    return MEDIA_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
}
/**
 * Resolve one requested artifact to a readable absolute path.
 *
 * A request is only honored when it names a workspace file the showcase could
 * actually show: inside the team's product root, or one of the artifacts a
 * task declared. Sibling assets of an HTML page (scripts, styles, images) are
 * covered by the product-root rule, so a page renders with its own bundle.
 */
export function resolveShowcaseAsset(workspace, team, requested) {
    const path = normalizeShowcasePath(requested);
    if (path === undefined)
        return { ok: false, status: 400, error: 'path must be workspace-relative' };
    if (isSkipped(path))
        return { ok: false, status: 403, error: 'path is not part of the delivery showcase' };
    const root = realRootOf(workspace);
    if (root === undefined)
        return { ok: false, status: 403, error: 'workspace cannot be resolved' };
    const view = buildShowcase(workspace, team);
    const insideProject = view.projectRoot !== undefined && (path === view.projectRoot || path.startsWith(view.projectRoot + '/'));
    const declared = view.files.some(file => file.path === path);
    if (!insideProject && !declared)
        return { ok: false, status: 403, error: 'path is outside the delivered artifacts' };
    const stat = statWorkspaceFile(workspace, root, path);
    if (stat === undefined)
        return { ok: false, status: 404, error: 'artifact not found' };
    if (stat.size > MAX_SHOWCASE_FILE_BYTES) {
        return { ok: false, status: 413, error: 'artifact is too large to preview' };
    }
    const mediaType = showcaseMediaType(path);
    return {
        ok: true,
        asset: {
            absolutePath: join(workspace, path),
            mediaType,
            size: stat.size,
            html: mediaType.startsWith('text/html'),
        },
    };
}
/**
 * Parse a mounted preview URL into its session, team and artifact path.
 *
 * The mount keeps session and team in the path (not only the query) so an
 * artifact's own relative references stay under the same authenticated prefix.
 * Malformed percent-encoding and short paths are rejected rather than
 * partially decoded.
 */
export function parseShowcaseFilePath(pathname, prefix) {
    const base = prefix.endsWith('/') ? prefix : prefix + '/';
    if (!pathname.startsWith(base))
        return undefined;
    const raw = pathname.slice(base.length);
    if (raw === '')
        return undefined;
    let segments;
    try {
        segments = raw.split('/').map(segment => decodeURIComponent(segment));
    }
    catch {
        return undefined;
    }
    if (segments.some(segment => segment === ''))
        return undefined;
    const [sessionId = '', teamId = '', ...rest] = segments;
    if (sessionId === '' || teamId === '' || rest.length === 0)
        return undefined;
    return { sessionId, teamId, path: rest.join('/') };
}
function escapeAttribute(value) {
    return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}
/**
 * Prepare a delivered HTML page for in-place preview.
 *
 * Two rewrites keep a page working when it is served from the plugin's mount
 * instead of its own directory: a <base> tag pins relative references, and
 * root-relative references ('/assets/app.js', the Vite default) are re-anchored
 * under the mount's directory for that page. Everything else is left intact —
 * the preview must show the artifact as built, not a sanitized re-render.
 */
export function rewriteShowcaseHtml(source, mountBase) {
    const base = mountBase.endsWith('/') ? mountBase : mountBase + '/';
    const rewritten = source.replace(/(\s(?:src|href|poster|action)\s*=\s*["'])\/(?!\/)/gi, (_match, prefix) => prefix + base);
    const tag = '<base href="' + escapeAttribute(base) + '">';
    if (/<head[^>]*>/i.test(rewritten))
        return rewritten.replace(/<head([^>]*)>/i, '<head$1>' + tag);
    return tag + rewritten;
}
