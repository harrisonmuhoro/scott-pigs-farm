<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
fwrite(STDERR, "Deprecated and intentionally disabled. Recovery-code reset is no longer supported; use the documented first-owner CLI provisioning process.\n");
exit(1);
