@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$portOpen = $false; $client = New-Object System.Net.Sockets.TcpClient; try { $attempt = $client.BeginConnect('127.0.0.1', 8080, $null, $null); $portOpen = $attempt.AsyncWaitHandle.WaitOne(400) -and $client.Connected } catch {} finally { $client.Close() }; if (-not $portOpen) { Start-Process -FilePath 'npm.cmd' -ArgumentList 'run serve' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden; for ($i = 0; $i -lt 20; $i++) { Start-Sleep -Milliseconds 250; $probe = New-Object System.Net.Sockets.TcpClient; try { $probe.Connect('127.0.0.1', 8080); if ($probe.Connected) { break } } catch {} finally { $probe.Close() } } }; Start-Process 'http://127.0.0.1:8080/frontend/index.html'"

endlocal
