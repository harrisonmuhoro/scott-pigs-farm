<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$actor = requireRole(['owner']);
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') respond(['error' => 'Method not allowed'], 405);
$kind = (string)($_GET['report'] ?? '');
$from = $_GET['from'] ?? null;
$to = $_GET['to'] ?? null;
$validDate = static function (mixed $value, string $name): ?string {
    if ($value === null || $value === '') return null;
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) || !checkdate((int)substr($value, 5, 2), (int)substr($value, 8, 2), (int)substr($value, 0, 4))) respond(['error' => "$name must use YYYY-MM-DD"], 422);
    return $value;
};
$from = $validDate($from, 'From date');
$to = $validDate($to, 'To date');
if ($from !== null && $to !== null && $from > $to) respond(['error' => 'From date must be before or equal to to date'], 422);
$reports = [
    'herd' => ['title' => 'herd', 'owner' => false, 'date' => 'p.created_at', 'sql' => 'SELECT p.id,p.tag_id,p.name,p.sex,p.breed,p.birth_date,p.birth_date_estimated,p.lifecycle_status,pen.code AS pen,p.source,p.acquired_date,p.created_at FROM pigs p LEFT JOIN pens pen ON pen.id=p.pen_id'],
    'litters' => ['title' => 'litters', 'owner' => false, 'date' => 'COALESCE(l.farrowing_date,l.expected_farrowing_date)', 'sql' => 'SELECT l.id,l.litter_code,p.tag_id AS dam_tag,s.tag_id AS sire_tag,l.mating_date,l.expected_farrowing_date,l.farrowing_date,l.total_born,l.born_alive,l.stillborn,l.fostered,l.weaned_count,l.weaned_date,l.notes FROM litters l JOIN pigs p ON p.id=l.dam_id LEFT JOIN pigs s ON s.id=l.sire_id'],
    'weights' => ['title' => 'weights', 'owner' => false, 'date' => 'w.measured_at', 'sql' => 'SELECT w.id,w.measured_at,p.tag_id,w.weight_kg,\'kg\' AS unit,w.notes FROM weight_records w JOIN pigs p ON p.id=w.pig_id'],
    'health' => ['title' => 'health', 'owner' => false, 'date' => 'h.occurred_on', 'sql' => 'SELECT h.id,h.occurred_on,h.record_type,p.tag_id,l.litter_code,h.symptoms,h.product_name,h.dose_as_entered,h.dose_unit,h.route,h.withdrawal_days,h.responsible_person,h.follow_up_due,h.follow_up_status,h.notes FROM health_records h LEFT JOIN pigs p ON p.id=h.pig_id LEFT JOIN litters l ON l.id=h.litter_id'],
    'stock' => ['title' => 'stock-movements', 'owner' => false, 'date' => 'm.movement_date', 'sql' => 'SELECT m.id,m.movement_date,i.sku,i.name,m.movement_type,m.quantity_delta,m.unit,m.unit_cost,m.batch_lot,m.expiry_date,m.reason,m.notes FROM stock_movements m JOIN inventory_items i ON i.id=m.item_id'],
    'purchases' => ['title' => 'purchases', 'owner' => false, 'date' => 'p.purchase_date', 'sql' => 'SELECT p.id,p.purchase_date,p.received_date,s.name AS supplier,p.invoice_reference,p.payment_status,p.amount_paid,COUNT(pl.id) AS line_count,CAST(COALESCE(SUM(pl.quantity*pl.unit_cost),0) AS DECIMAL(14,2)) AS total_cost,p.notes FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN purchase_lines pl ON pl.purchase_id=p.id'],
    'sales' => ['title' => 'sales', 'owner' => false, 'date' => 's.sale_date', 'sql' => 'SELECT s.id,s.sale_date,s.customer,s.reference,s.total,s.amount_paid,s.payment_status,s.payment_method,COUNT(sl.id) AS line_count,s.notes FROM sales s JOIN sale_lines sl ON sl.sale_id=s.id'],
    'finance' => ['title' => 'finance', 'owner' => true, 'date' => 't.transaction_date', 'sql' => 'SELECT t.id,t.transaction_date,t.transaction_type,t.accounting_class,t.category,t.amount,t.amount_paid,t.currency,t.payment_status,t.payment_method,t.counterparty,t.reference,t.source_type,t.source_id,t.notes FROM financial_transactions t'],
];
if (!isset($reports[$kind])) respond(['error' => 'Choose a supported report'], 422);
if ($reports[$kind]['owner'] && $actor['role'] !== 'owner') respond(['error' => 'Owner access required'], 403);
$where = [];
$params = [];
if ($from !== null) { $where[] = $reports[$kind]['date'] . '>=?'; $params[] = $from; }
if ($to !== null) { $where[] = $reports[$kind]['date'] . '<=?'; $params[] = $to; }
$groupBy = in_array($kind, ['purchases', 'sales'], true) ? ' GROUP BY ' . ($kind === 'purchases' ? 'p.id' : 's.id') : '';
$orderBy = $reports[$kind]['date'];
$sql = $reports[$kind]['sql'] . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . $groupBy . ' ORDER BY ' . $orderBy . ' DESC LIMIT 10001';
$statement = $pdo->prepare($sql);
$statement->execute($params);
$columns = [];
for ($index = 0; $index < $statement->columnCount(); $index++) {
    $meta = $statement->getColumnMeta($index);
    $columns[] = $meta['name'] ?? 'column_' . ($index + 1);
}
$rows = $statement->fetchAll(PDO::FETCH_ASSOC);
if (count($rows) > 10000) respond(['error' => 'This report exceeds 10,000 rows. Narrow the date range and try again.'], 413);
auditEvent($pdo, $actor['id'], 'report.exported', 'report', $kind, ['from' => $from, 'to' => $to, 'row_count' => count($rows)]);
$format = (string)($_GET['format'] ?? 'csv');
if ($format === 'print') {
    $title = htmlspecialchars(ucwords(str_replace(['-', '_'], ' ', $reports[$kind]['title'])), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $period = htmlspecialchars(($from ?? 'All dates') . ' to ' . ($to ?? 'All dates'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    header('Content-Type: text/html; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' . $title . ' report · Scott Pigs Farm</title><style>';
    echo 'body{font:14px Arial,sans-serif;color:#172033;margin:24px}h1{margin:0 0 6px;color:#7f1d1d}p{color:#475569}.toolbar{margin:18px 0}.toolbar button{padding:9px 14px;background:#7f1d1d;color:white;border:0;border-radius:5px;font-weight:600;cursor:pointer}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left;vertical-align:top}th{background:#f1f5f9;white-space:nowrap}tr{break-inside:avoid}@media print{body{margin:8mm}.no-print{display:none!important}.table-wrap{overflow:visible}table{font-size:9pt}th{background:#e2e8f0!important;print-color-adjust:exact}}</style></head><body>';
    echo '<h1>Scott Pigs Farm · ' . $title . ' report</h1><p>Period: ' . $period . ' · Rows: ' . count($rows) . '</p><div class="toolbar no-print"><button type="button" onclick="window.print()">Print / Save as PDF</button></div><div class="table-wrap"><table><thead><tr>';
    foreach ($columns as $column) echo '<th>' . htmlspecialchars((string)$column, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</th>';
    echo '</tr></thead><tbody>';
    foreach ($rows as $row) {
        echo '<tr>';
        foreach ($columns as $column) echo '<td>' . htmlspecialchars((string)($row[$column] ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</td>';
        echo '</tr>';
    }
    if (!$rows) echo '<tr><td colspan="' . max(1, count($columns)) . '">No records match this date range.</td></tr>';
    echo '</tbody></table></div></body></html>';
    exit;
}
if ($format === 'xlsx') {
    if (!class_exists(ZipArchive::class)) respond(['error' => 'XLSX export is unavailable because PHP ZipArchive is not enabled'], 503);
    $sheetTitle = preg_replace('/[^A-Za-z0-9 ]/', '', ucwords(str_replace(['-', '_'], ' ', $reports[$kind]['title']))) ?: 'Report';
    $sheetTitle = mb_substr($sheetTitle, 0, 31);
    $filename = 'scott-farm-' . $reports[$kind]['title'] . '-' . ($from ?? 'all') . '-to-' . ($to ?? 'all') . '.xlsx';
    $xml = static fn(string $value): string => htmlspecialchars(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $value) ?? '', ENT_XML1 | ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $columnName = static function (int $number): string {
        $name = '';
        while ($number > 0) {
            $number--;
            $name = chr(65 + ($number % 26)) . $name;
            $number = intdiv($number, 26);
        }
        return $name;
    };
    $sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    $sheet .= '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData>';
    $allRows = array_merge([$columns], array_map(static fn(array $row): array => array_map(static fn($column) => $row[$column] ?? null, $columns), $rows));
    foreach ($allRows as $rowIndex => $row) {
        $excelRow = $rowIndex + 1;
        $sheet .= '<row r="' . $excelRow . '">';
        foreach (array_values($row) as $columnIndex => $value) {
            $reference = $columnName($columnIndex + 1) . $excelRow;
            $textValue = (string)($value ?? '');
            $numericDigits = strlen(ltrim(str_replace(['-', '.'], '', $textValue), '0'));
            $numericColumns = ['amount', 'amount_paid', 'total', 'total_cost', 'weight_kg', 'unit_cost', 'quantity_delta', 'line_count', 'total_born', 'born_alive', 'stillborn', 'fostered', 'weaned_count', 'withdrawal_days'];
            $column = $columns[$columnIndex] ?? '';
            if ($rowIndex > 0 && $value !== null && in_array((string)$column, $numericColumns, true) && is_scalar($value) && preg_match('/^-?\d+(?:\.\d+)?$/', $textValue) && $numericDigits <= 15) {
                $sheet .= '<c r="' . $reference . '"><v>' . $xml($textValue) . '</v></c>';
            } else {
                $sheet .= '<c r="' . $reference . '" t="inlineStr"><is><t xml:space="preserve">' . $xml($textValue) . '</t></is></c>';
            }
        }
        $sheet .= '</row>';
    }
    $sheet .= '</sheetData><autoFilter ref="A1:' . $columnName(max(1, count($columns))) . max(1, count($allRows)) . '"/></worksheet>';
    $package = [
        '[Content_Types].xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        '_rels/.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        'xl/workbook.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' . $xml($sheetTitle) . '" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        'xl/worksheets/sheet1.xml' => $sheet,
    ];
    $temporary = tempnam(sys_get_temp_dir(), 'scott-xlsx-');
    if ($temporary === false) respond(['error' => 'Could not prepare the workbook'], 500);
    $archive = new ZipArchive();
    $opened = $archive->open($temporary, ZipArchive::OVERWRITE);
    if ($opened !== true) { @unlink($temporary); respond(['error' => 'Could not prepare the workbook'], 500); }
    foreach ($package as $path => $contents) $archive->addFromString($path, $contents);
    $closed = $archive->close();
    if (!$closed || !is_file($temporary)) { @unlink($temporary); respond(['error' => 'Could not finish the workbook'], 500); }
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('X-Content-Type-Options: nosniff');
    header('Content-Length: ' . filesize($temporary));
    readfile($temporary);
    @unlink($temporary);
    exit;
}
if ($format !== 'csv') respond(['error' => 'Choose CSV, XLSX, or print format'], 422);
$filename = 'scott-farm-' . $reports[$kind]['title'] . '-' . ($from ?? 'all') . '-to-' . ($to ?? 'all') . '.csv';
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('X-Content-Type-Options: nosniff');
$output = fopen('php://output', 'wb');
fwrite($output, "\xEF\xBB\xBF");
fputcsv($output, $columns, ',', '"', '');
foreach ($rows as $row) {
        $safe = array_map(static function (mixed $value): mixed {
            if (!is_string($value)) return $value;
            return preg_match('/^[=+@\-\t\r]/', $value) ? "'" . $value : $value;
        }, array_values($row));
        fputcsv($output, $safe, ',', '"', '');
}
fclose($output);
