copy /y sitios.7z \\10.18.226.137\C$\users\raul.salitrero\Desktop
call rimraf \\10.18.226.137\C$\users\raul.salitrero\Desktop\sitios
copy /y sitios.7z \\10.18.226.171\C$\users\raul.salitrero\Desktop
call rimraf \\10.18.226.171\C$\users\raul.salitrero\Desktop\sitios
copy /y sitios.7z \\10.18.226.211\C$\users\raul.salitrero\Desktop
call rimraf \\10.18.226.211\C$\users\raul.salitrero\Desktop\sitios
copy /y sitios.7z \\10.18.226.212\C$\users\raul.salitrero\Desktop
call rimraf \\10.18.226.212\C$\users\raul.salitrero\Desktop\sitios
copy /y sitios.7z \\10.18.226.213\C$\users\raul.salitrero\Desktop
call rimraf \\10.18.226.213\C$\users\raul.salitrero\Desktop\sitios
rem copy /y sitios.7z \\10.18.226.200\C$\users\raul.salitrero\Desktop
rem call rimraf \\10.18.226.200\C$\users\raul.salitrero\Desktop\sitios

start mstsc /v:10.18.226.137 /admin
start mstsc /v:10.18.226.171 /admin
rem el 163 no cepta copy automatico copiar archivos a mano
start mstsc /v:10.18.226.163:33890 /admin
start mstsc /v:10.18.226.211 /admin
start mstsc /v:10.18.226.212 /admin
start mstsc /v:10.18.226.213 /admin

rem start mstsc /v:10.18.226.200 /admin
