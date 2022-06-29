SETLOCAL
set CP=robocopy
set WINRAR="C:\Program Files\WinRAR\winrar"
del /S /Q misc\tmp
rmdir /S /Q misc\tmp
mkdir misc\tmp
del /S /Q ear_dmh.zip aer_dmh_ff.zip

%CP% aer_dmh misc\tmp\aer_dmh /E
del /S /Q misc\tmp\aer_dmh\manifest_ff.json
%WINRAR% A aer_dmh.zip -ep1 -r misc\tmp\aer_dmh

copy aer_dmh\manifest_ff.json misc\tmp\aer_dmh\manifest.json
%WINRAR% A aer_dmh_ff.zip -ep1 -r misc\tmp\aer_dmh\*

del /S /Q misc\tmp
rmdir /S /Q misc\tmp

pause
ENDLOCAL