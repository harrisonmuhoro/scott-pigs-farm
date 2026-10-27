<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

// Render uses this endpoint to distinguish a running PHP process from a failed
// database connection. It intentionally does not expose credentials or schema.
respond(['status' => 'ok', 'service' => 'scott-pigs-api']);
