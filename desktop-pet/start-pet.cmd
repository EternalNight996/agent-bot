@echo off
setlocal
set "HERE=%~dp0"
set "PY=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\pythonw.exe"
if not exist "%PY%" set "PY=pythonw"
pushd "%HERE%.."
start "" "%PY%" "%HERE%pet.py" --workspace "%CD%"
popd
endlocal
