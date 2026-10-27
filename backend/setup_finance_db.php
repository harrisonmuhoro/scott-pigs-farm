<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
fwrite(STDERR, "Deprecated setup script. Initialize monthly_finances from the documented database migrations instead.\n");
exit(1);
