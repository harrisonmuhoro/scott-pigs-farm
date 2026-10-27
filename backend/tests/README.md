# Integration and security checks

Run integration checks only against a disposable restored database. The runner refuses databases that do not match `scott_pigs_restore_*`.

```powershell
$env:SCOTT_DB_NAME = 'scott_pigs_restore_20261025'
$env:SCOTT_TEST_DB_USER = 'root'
$env:SCOTT_TEST_DB_PASSWORD = ''
D:\wamp64\bin\php\php8.4.15\php.exe tests\integration.php
Remove-Item Env:SCOTT_DB_NAME
Remove-Item Env:SCOTT_TEST_DB_USER
Remove-Item Env:SCOTT_TEST_DB_PASSWORD
```

The test wraps disposable pig, group, pen, and membership writes in a transaction and rolls them back. It does not test the live farm database. Unauthenticated endpoint and CORS checks can be run separately with `curl.exe` against the local Apache URL.

Run the local endpoint checks with:

```powershell
powershell -ExecutionPolicy Bypass -File tests\security.ps1
```
