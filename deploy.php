<?php
/**
 * Deploy endpoint — triggers git pull / server restart with real-time status.
 * Usage: GET /chess/deploy.php?token=SECRET&target=client|server|both
 *
 * Writes deploy-status.json at each step so deploying.html can show progress.
 */

header('Content-Type: application/json');

$statusFile = __DIR__ . '/deploy-status.json';
$maxHistory = 10;

/* ------------------------------------------------------------------ */
/*  Status file helpers                                                */
/* ------------------------------------------------------------------ */

function readStatus($file) {
    if (!is_readable($file)) {
        return ['deploying' => false, 'history' => []];
    }
    $data = json_decode(file_get_contents($file), true);
    return is_array($data) ? $data : ['deploying' => false, 'history' => []];
}

function writeStatus($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

function addStep(&$status, $name, $stepStatus = 'active') {
    // Mark previous active step as done
    if (isset($status['steps'])) {
        foreach ($status['steps'] as &$s) {
            if ($s['status'] === 'active') {
                $s['status'] = 'done';
            }
        }
        unset($s);
    }
    $status['steps'][] = [
        'name'   => $name,
        'time'   => gmdate('c'),
        'status' => $stepStatus,
    ];
    $status['currentStep'] = $name;
}

function startDeploy($file, $target, $maxHistory) {
    $prev = readStatus($file);
    $status = [
        'deploying'   => true,
        'target'      => $target,
        'startedAt'   => gmdate('c'),
        'currentStep' => 'starting',
        'steps'       => [
            ['name' => 'starting', 'time' => gmdate('c'), 'status' => 'active'],
        ],
        'history'     => $prev['history'] ?? [],
    ];
    writeStatus($file, $status);
    return $status;
}

function completeDeploy($file, &$status, $success, $maxHistory) {
    addStep($status, 'complete', $success ? 'done' : 'error');
    $status['deploying'] = false;

    // Append to history
    $historyEntry = [
        'target'      => $status['target'],
        'startedAt'   => $status['startedAt'],
        'completedAt' => gmdate('c'),
        'duration'    => time() - strtotime($status['startedAt']),
        'status'      => $success ? 'success' : 'failed',
    ];
    array_unshift($status['history'], $historyEntry);
    $status['history'] = array_slice($status['history'], 0, $maxHistory);

    writeStatus($file, $status);
}

/* ------------------------------------------------------------------ */
/*  Run a single shell command and capture output                      */
/* ------------------------------------------------------------------ */

function runCmd($cmd) {
    $output = [];
    $rc = 0;
    exec($cmd . ' 2>&1', $output, $rc);
    return ['output' => $output, 'rc' => $rc];
}

/* ------------------------------------------------------------------ */
/*  Token validation                                                   */
/* ------------------------------------------------------------------ */

$tokenFile = '/home/bitnami/server/.deploy-token';
if (!is_readable($tokenFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'Deploy token not readable']);
    exit;
}
$expectedToken = trim(file_get_contents($tokenFile));
if (strlen($expectedToken) === 0) {
    http_response_code(500);
    echo json_encode(['error' => 'Deploy token is empty']);
    exit;
}

$providedToken = $_GET['token'] ?? '';
if (strlen($providedToken) === 0 || !hash_equals($expectedToken, $providedToken)) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

/* ------------------------------------------------------------------ */
/*  Target validation                                                  */
/* ------------------------------------------------------------------ */

$target = $_GET['target'] ?? 'client';
if (!in_array($target, ['client', 'server', 'both'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid target. Use: client, server, both']);
    exit;
}

/* ------------------------------------------------------------------ */
/*  Deploy with step-by-step status                                    */
/* ------------------------------------------------------------------ */

$status = startDeploy($statusFile, $target, $maxHistory);
$allOutput = [];
$blocked = false;
$failed = false;

if ($target === 'server' || $target === 'both') {
    // Step: Pull server code
    addStep($status, 'pulling-server');
    writeStatus($statusFile, $status);
    $result = runCmd('sudo -u bitnami bash -c "cd /home/bitnami/server/chess-api && git checkout -- package-lock.json && git pull origin main"');
    $allOutput = array_merge($allOutput, $result['output']);
    if ($result['rc'] !== 0) {
        $failed = true;
    }

    if (!$failed) {
        // Step: Install dependencies
        addStep($status, 'installing-deps');
        writeStatus($statusFile, $status);
        $result = runCmd('sudo -u bitnami bash -c "cd /home/bitnami/server/chess-api && npm install --production"');
        $allOutput = array_merge($allOutput, $result['output']);
        if ($result['rc'] !== 0) {
            $failed = true;
        }
    }

    if (!$failed) {
        // Step: Restart server
        addStep($status, 'restarting-server');
        writeStatus($statusFile, $status);
        $result = runCmd('sudo -u bitnami bash -c "pm2 restart chess-api"');
        $allOutput = array_merge($allOutput, $result['output']);
        if ($result['rc'] !== 0) {
            $failed = true;
        }
    }
}

if (!$failed) {
    if ($target === 'client' || $target === 'server' || $target === 'both') {
        // Step: Check version compatibility (client-only deploys)
        if ($target === 'client') {
            addStep($status, 'checking-version');
            writeStatus($statusFile, $status);

            // Read client's required version from the remote
            $reqResult = runCmd('sudo -u bitnami bash -c "cd /opt/bitnami/apache/htdocs/chess && git fetch origin main && git show origin/main:package.json"');
            $remotePackage = implode("\n", $reqResult['output']);
            $remoteData = json_decode($remotePackage, true);
            $requiredApiVersion = $remoteData['requiredApiVersion'] ?? '0';

            // Read server's current version
            $srvResult = runCmd('sudo -u bitnami bash -c "cat /home/bitnami/server/chess-api/package.json"');
            $srvPackage = implode("\n", $srvResult['output']);
            $srvData = json_decode($srvPackage, true);
            $serverVersion = $srvData['version'] ?? '0';

            // Compare major versions
            $reqMajor = intval(explode('.', $requiredApiVersion)[0]);
            $srvMajor = intval(explode('.', $serverVersion)[0]);

            if ($reqMajor > $srvMajor) {
                $blocked = true;
                $allOutput[] = "BLOCKED: Client requires API v{$requiredApiVersion} but server is v{$serverVersion}";
            }
        }

        if (!$blocked) {
            // Step: Pull client code
            addStep($status, 'pulling-client');
            writeStatus($statusFile, $status);
            $result = runCmd('sudo -u bitnami bash -c "cd /opt/bitnami/apache/htdocs/chess && git pull origin main"');
            $allOutput = array_merge($allOutput, $result['output']);
            if ($result['rc'] !== 0) {
                $failed = true;
            }
        }
    }
}

// Finalize
completeDeploy($statusFile, $status, !$failed && !$blocked, $maxHistory);

// Return response (backwards-compatible with GitHub Actions)
if ($blocked) {
    http_response_code(409);
    echo json_encode([
        'status'  => 'blocked',
        'message' => 'Client deploy blocked — server version too old',
        'output'  => array_values(array_filter($allOutput)),
    ]);
} elseif ($failed) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'target' => $target,
        'output' => array_values(array_filter($allOutput)),
    ]);
} else {
    echo json_encode([
        'status' => 'ok',
        'target' => $target,
        'output' => array_values(array_filter($allOutput)),
    ]);
}
