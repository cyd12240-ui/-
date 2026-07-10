Set WshShell = WScript.CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "E:\WXdp"
WshShell.Run "node.exe server\index.js", 0, False
